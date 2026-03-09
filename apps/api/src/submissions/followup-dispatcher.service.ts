import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { EmailSenderService } from '../email/email-sender.service';

interface DueFollowup {
  id: string;
  submissionId: string;
  number: number;
  scheduledAt: Date;
  submissionStatus: string;
  sentEmailId: string | null;
  sentConversationId: string | null;
  sentFrom: string | null;
  sentTo: string | null;
  sentSubject: string | null;
  consultantName: string;
  jobTitle: string;
  vendorName: string;
  vendorTrustScore: number | null;
}

@Injectable()
export class FollowupDispatcherService {
  private readonly logger = new Logger(FollowupDispatcherService.name);
  private running = false;

  constructor(
    private prisma: PrismaService,
    private emailSender: EmailSenderService,
  ) {}

  @Cron(CronExpression.EVERY_10_MINUTES)
  async dispatchDueFollowups() {
    if (this.running) {
      this.logger.debug('Followup dispatcher already running, skipping');
      return;
    }

    this.running = true;
    try {
      await this.processFollowups();
    } finally {
      this.running = false;
    }
  }

  async processFollowups() {
    let dueFollowups: DueFollowup[] = [];
    try {
      dueFollowups = await this.prisma.$queryRaw`
        SELECT 
          sf.id,
          sf.submission_id as "submissionId",
          sf.followup_number as "number",
          sf.scheduled_at as "scheduledAt",
          s.status as "submissionStatus",
          s."sentEmailId",
          s."sentConversationId",
          s."sentFrom",
          s."sentTo",
          s."sentSubject",
          c."firstName" || ' ' || c."lastName" as "consultantName",
          j.title as "jobTitle",
          v."companyName" as "vendorName",
          v."trustScore" as "vendorTrustScore"
        FROM submission_followup sf
        JOIN "Submission" s ON s.id = sf.submission_id
        JOIN "Consultant" c ON c.id = s."consultantId"
        JOIN "Job" j ON j.id = s."jobId"
        JOIN "Vendor" v ON v.id = j."vendorId"
        WHERE sf.status = 'PENDING'
          AND sf.scheduled_at <= NOW()
          AND s.status IN ('SUBMITTED')
        ORDER BY sf.scheduled_at ASC
        LIMIT 30
      ` as DueFollowup[];
    } catch {
      this.logger.debug('submission_followup table may not exist');
      return;
    }

    if (dueFollowups.length === 0) {
      this.logger.debug('No due follow-ups');
      return;
    }

    this.logger.log(`Processing ${dueFollowups.length} due follow-ups`);

    let sent = 0;
    let failed = 0;
    let escalated = 0;

    for (const fu of dueFollowups) {
      try {
        // Escalation: HIGH trust vendor + silent after follow-up #2
        if (fu.number >= 3 && fu.vendorTrustScore && fu.vendorTrustScore >= 70) {
          await this.escalateToHuman(fu);
          escalated++;
          continue;
        }

        if (!fu.sentEmailId || !fu.sentFrom || !fu.sentTo) {
          this.logger.warn(`Followup ${fu.id}: original email not sent via Graph, marking as sent (manual)`);
          await this.markSent(fu.id, fu.submissionId, fu.number, null);
          sent++;
          continue;
        }

        const followupBody = this.generateFollowupBody(fu);

        const result = await this.emailSender.replyToMessage(
          fu.sentFrom,
          fu.sentEmailId,
          followupBody,
        );

        await this.prisma.submissionEmailThread.create({
          data: {
            submissionId: fu.submissionId,
            direction: 'OUTBOUND',
            emailType: `FOLLOWUP_${fu.number}`,
            graphMessageId: result.messageId,
            conversationId: result.conversationId,
            internetMsgId: result.internetMessageId,
            fromEmail: fu.sentFrom,
            toEmails: [fu.sentTo],
            subject: `Re: ${fu.sentSubject || 'Submission'}`,
            bodyPreview: followupBody.slice(0, 500),
            sentAt: new Date(result.sentAt),
          },
        });

        await this.markSent(fu.id, fu.submissionId, fu.number, result.messageId);
        sent++;

        this.logger.log(
          `Followup #${fu.number} sent for submission ${fu.submissionId} (${fu.consultantName} → ${fu.vendorName})`,
        );

        // Rate limit: 500ms between sends
        await new Promise((r) => setTimeout(r, 500));
      } catch (err: any) {
        failed++;
        this.logger.error(
          `Followup ${fu.id} failed: ${err.message}`,
        );
        // Don't mark as sent — it'll retry next cycle
      }
    }

    this.logger.log(
      `Followup dispatch complete: ${sent} sent, ${failed} failed, ${escalated} escalated`,
    );
  }

  private generateFollowupBody(fu: DueFollowup): string {
    const templates: Record<number, string> = {
      1: `Hi,<br><br>Just following up on my submission of <b>${fu.consultantName}</b> for the <b>${fu.jobTitle}</b> position. Please let me know if you need any additional information or if you'd like to schedule an interview.<br><br>Best regards`,

      2: `Hi,<br><br>Following up again regarding <b>${fu.consultantName}</b> for the <b>${fu.jobTitle}</b> role. ${fu.consultantName} remains available and interested. Would appreciate any update on the status.<br><br>Best regards`,

      3: `Hi,<br><br>This is my final follow-up regarding the submission of <b>${fu.consultantName}</b> for <b>${fu.jobTitle}</b>. If the position has been filled or is no longer active, please let me know so I can update our records.<br><br>Thank you for your time.<br><br>Best regards`,
    };

    return templates[fu.number] ?? templates[3]!;
  }

  private async markSent(followupId: string, submissionId: string, number: number, graphMessageId: string | null) {
    try {
      await this.prisma.$executeRaw`
        UPDATE submission_followup SET status = 'SENT', sent_at = NOW()
        WHERE id = ${followupId}::uuid
      `;
    } catch {
      // submission_followup table may not exist
    }

    await this.prisma.$executeRaw`
      INSERT INTO submission_event (submission_id, event_type, actor, details)
      VALUES (
        ${submissionId},
        ${'FOLLOWUP_' + number + '_SENT'},
        'followup-dispatcher',
        ${JSON.stringify({ followupId, graphMessageId, automated: true })}::jsonb
      )
    `;
  }

  private async escalateToHuman(fu: DueFollowup) {
    try {
      await this.prisma.$executeRaw`
        UPDATE submission_followup SET status = 'ESCALATED', sent_at = NOW()
        WHERE id = ${fu.id}::uuid
      `;
    } catch {
      // submission_followup table may not exist
    }

    await this.prisma.$executeRaw`
      INSERT INTO submission_event (submission_id, event_type, actor, details)
      VALUES (
        ${fu.submissionId},
        'FOLLOWUP_ESCALATED',
        'followup-dispatcher',
        ${JSON.stringify({
          followupNumber: fu.number,
          reason: 'High-trust vendor silent after multiple follow-ups',
          vendorTrustScore: fu.vendorTrustScore,
          vendorName: fu.vendorName,
        })}::jsonb
      )
    `;

    this.logger.warn(
      `ESCALATED: Submission ${fu.submissionId} — ${fu.vendorName} (trust: ${fu.vendorTrustScore}) silent after follow-up #${fu.number}`,
    );
  }
}
