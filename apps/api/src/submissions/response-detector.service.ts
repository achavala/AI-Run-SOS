import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

type ResponseType =
  | 'ACKNOWLEDGED'
  | 'NEED_RTR'
  | 'RATE_TOO_HIGH'
  | 'NOT_A_MATCH'
  | 'INTERVIEW_REQUEST'
  | 'CLIENT_SUBMITTED'
  | 'NO_THIRD_PARTY'
  | 'POSITION_CLOSED'
  | 'UNKNOWN';

interface ClassifiedResponse {
  type: ResponseType;
  confidence: number;
  matchedPattern: string;
}

const RESPONSE_PATTERNS: Array<{ type: ResponseType; patterns: RegExp[]; confidence: number }> = [
  {
    type: 'INTERVIEW_REQUEST',
    patterns: [
      /\b(interview|screen|call|meet|chat|discuss|available\s+for\s+a\s+call|phone\s+screen|teams\s+call|zoom|technical\s+round)\b/i,
      /\b(schedule|set\s+up|arrange|book)\s+(an?\s+)?(interview|meeting|call|discussion)\b/i,
      /\bwhen\s+(is|are)\s+(he|she|they|the\s+candidate)\s+available\b/i,
      /\bplease\s+(share|send|provide)\s+(availability|calendar)\b/i,
    ],
    confidence: 0.9,
  },
  {
    type: 'NEED_RTR',
    patterns: [
      /\b(need|send|provide|share|attach)\s+(the\s+)?(rtr|right\s+to\s+represent|authorization|visa\s+copy|dl\s+copy|ssn\s+last\s+4)\b/i,
      /\brtr\s+(required|needed|missing)\b/i,
      /\bplease\s+confirm\s+(rtr|right\s+to\s+represent)\b/i,
    ],
    confidence: 0.85,
  },
  {
    type: 'CLIENT_SUBMITTED',
    patterns: [
      /\b(submitted|presented|forwarded)\s+(to|with)\s+(the\s+)?(client|end\s*client|hiring\s+manager)\b/i,
      /\bclient\s+(review|has\s+received|is\s+reviewing)\b/i,
      /\bprofile\s+(has\s+been\s+)?(shared|submitted|sent)\b/i,
    ],
    confidence: 0.85,
  },
  {
    type: 'RATE_TOO_HIGH',
    patterns: [
      /\brate\s+(is\s+)?(too\s+high|above|exceeds|over\s+budget|not\s+in\s+budget|out\s+of\s+range)\b/i,
      /\b(budget|max\s+rate|bill\s+rate)\s+(is|only|around)\s+\$?\d/i,
      /\breduce\s+(the\s+)?rate\b/i,
      /\bcan\s+(you|they)\s+(do|work\s+at)\s+\$?\d+/i,
    ],
    confidence: 0.8,
  },
  {
    type: 'NOT_A_MATCH',
    patterns: [
      /\bnot\s+(a\s+)?(good\s+)?(fit|match|suitable)\b/i,
      /\b(skills?|experience|qualifications?)\s+(don'?t|do\s+not|doesn'?t)\s+match\b/i,
      /\bwe('re|\s+are)\s+(looking|need)\s+(for\s+)?(someone|a\s+candidate)\s+with\b/i,
      /\bdeclined\b/i,
      /\bpassed?\s+on\s+this\s+candidate\b/i,
    ],
    confidence: 0.75,
  },
  {
    type: 'POSITION_CLOSED',
    patterns: [
      /\b(position|role|req|opening)\s+(has\s+been\s+)?(closed|filled|cancelled|on\s+hold|put\s+on\s+hold)\b/i,
      /\bno\s+longer\s+(open|active|available|hiring)\b/i,
      /\bwe('ve|\s+have)\s+(already\s+)?(filled|closed)\b/i,
    ],
    confidence: 0.9,
  },
  {
    type: 'NO_THIRD_PARTY',
    patterns: [
      /\bno\s+(3rd|third)\s+party\b/i,
      /\bno\s+c2c\b/i,
      /\bno\s+corp\s*to\s*corp\b/i,
      /\bdirect\s+(client|hire)\s+only\b/i,
      /\bw2\s+only\b/i,
    ],
    confidence: 0.95,
  },
  {
    type: 'ACKNOWLEDGED',
    patterns: [
      /\b(received|got\s+it|noted|acknowledged|thank\s*you|thanks|will\s+review)\b/i,
      /\b(reviewing|looking\s+at|checking)\s+(the\s+)?(profile|resume|submission|candidate)\b/i,
    ],
    confidence: 0.6,
  },
];

@Injectable()
export class ResponseDetectorService {
  private readonly logger = new Logger(ResponseDetectorService.name);
  private running = false;

  constructor(private prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async detectResponses() {
    if (this.running) return;
    this.running = true;
    try {
      await this.processInboundEmails();
    } finally {
      this.running = false;
    }
  }

  async processInboundEmails() {
    const unprocessed = await this.prisma.rawEmailMessage.findMany({
      where: {
        sentAt: { gte: new Date(Date.now() - 24 * 3600_000) },
        processed: true,
        responseProcessed: false,
      },
      select: {
        id: true,
        fromEmail: true,
        subject: true,
        bodyText: true,
        sentAt: true,
        conversationId: true,
        internetMessageId: true,
        category: true,
      },
      orderBy: { sentAt: 'desc' },
      take: 100,
    });

    if (unprocessed.length === 0) return;

    this.logger.log(`Scanning ${unprocessed.length} inbound emails for submission responses`);

    let matched = 0;
    let updated = 0;

    for (const email of unprocessed) {
      const submission = await this.matchEmailToSubmission(email);

      // Mark as response-processed regardless
      await this.prisma.rawEmailMessage.update({
        where: { id: email.id },
        data: { responseProcessed: true },
      });

      if (!submission) continue;
      matched++;

      const bodyToClassify = (email.bodyText || email.subject || '').slice(0, 3000);
      const classification = this.classifyResponse(bodyToClassify);

      if (classification.type === 'UNKNOWN') continue;

      await this.handleClassifiedResponse(submission, email, classification);
      updated++;
    }

    if (matched > 0) {
      this.logger.log(`Response detection: ${matched} matched, ${updated} status updates`);
    }
  }

  private async matchEmailToSubmission(email: any): Promise<any | null> {
    // Strategy 1: Match by conversationId
    if (email.conversationId) {
      const byConversation = await this.prisma.submission.findFirst({
        where: {
          sentConversationId: email.conversationId,
          status: { in: ['SUBMITTED', 'CONSENT_PENDING', 'INTERVIEWING'] },
        },
        include: { job: { include: { vendor: true } } },
      });

      if (byConversation) {
        return {
          id: byConversation.id,
          status: byConversation.status,
          tenantId: byConversation.tenantId,
          jobId: byConversation.jobId,
          consultantId: byConversation.consultantId,
          vendorId: byConversation.job.vendorId,
          vendorName: byConversation.job.vendor.companyName,
          vendorDomain: byConversation.job.vendor.domain,
        };
      }
    }

    // Strategy 2: Match by subject line + sender domain
    if (email.subject && email.fromEmail) {
      const senderDomain = email.fromEmail.split('@')[1]?.toLowerCase();
      if (!senderDomain) return null;

      const bySubjectDomain = await this.prisma.$queryRaw<any[]>`
        SELECT s.id, s.status, s."tenantId", s."jobId", s."consultantId",
               j."vendorId", v."companyName" as "vendorName", v.domain as "vendorDomain"
        FROM "Submission" s
        JOIN "Job" j ON j.id = s."jobId"
        JOIN "Vendor" v ON v.id = j."vendorId"
        WHERE s."sentSubject" IS NOT NULL
          AND s.status IN ('SUBMITTED', 'CONSENT_PENDING', 'INTERVIEWING')
          AND (
            ${email.subject}::text ILIKE '%' || s."sentSubject" || '%'
            OR s."sentSubject" ILIKE '%' || ${email.subject}::text || '%'
          )
          AND v.domain = ${senderDomain}
        ORDER BY s."sentAt" DESC
        LIMIT 1
      `;

      if (bySubjectDomain.length > 0) return bySubjectDomain[0];
    }

    return null;
  }

  classifyResponse(text: string): ClassifiedResponse {
    let best: ClassifiedResponse = { type: 'UNKNOWN', confidence: 0, matchedPattern: '' };

    for (const rule of RESPONSE_PATTERNS) {
      for (const pattern of rule.patterns) {
        const match = text.match(pattern);
        if (match && rule.confidence > best.confidence) {
          best = {
            type: rule.type,
            confidence: rule.confidence,
            matchedPattern: match[0],
          };
        }
      }
    }

    return best;
  }

  private async handleClassifiedResponse(
    submission: any,
    email: any,
    classification: ClassifiedResponse,
  ) {
    const statusMap: Partial<Record<ResponseType, string>> = {
      INTERVIEW_REQUEST: 'INTERVIEWING',
      POSITION_CLOSED: 'CLOSED',
      NO_THIRD_PARTY: 'REJECTED',
      NOT_A_MATCH: 'REJECTED',
    };

    const newStatus = statusMap[classification.type];

    await this.prisma.submissionEmailThread.create({
      data: {
        submissionId: submission.id,
        direction: 'INBOUND',
        emailType: 'VENDOR_REPLY',
        conversationId: email.conversationId,
        internetMsgId: email.internetMessageId,
        fromEmail: email.fromEmail,
        toEmails: [],
        subject: email.subject || '',
        bodyPreview: (email.bodyText || '').slice(0, 500),
        sentAt: new Date(email.sentAt),
      },
    });

    await this.prisma.submissionEvent.create({
      data: {
        submissionId: submission.id,
        eventType: `RESPONSE_${classification.type}`,
        actor: 'response-detector',
        details: {
          sourceEmailId: email.id,
          fromEmail: email.fromEmail,
          responseType: classification.type,
          confidence: classification.confidence,
          matchedPattern: classification.matchedPattern,
          automated: true,
        },
      },
    });

    if (newStatus && classification.confidence >= 0.8) {
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: newStatus as any,
          vendorFeedback: `[auto-detected] ${classification.type}: "${classification.matchedPattern}"`,
          feedbackReceivedAt: new Date(),
        },
      });

      if (['CLOSED', 'REJECTED'].includes(newStatus)) {
        await this.prisma.submissionFollowup.updateMany({
          where: { submissionId: submission.id, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });
      }

      this.logger.log(
        `Auto-updated submission ${submission.id}: ${submission.status} → ${newStatus} (${classification.type}, confidence: ${classification.confidence})`,
      );
    }

    await this.emitTrustEvent(submission, classification);
  }

  private async emitTrustEvent(submission: any, classification: ClassifiedResponse) {
    const feedbackTypeMap: Partial<Record<ResponseType, string>> = {
      INTERVIEW_REQUEST: 'INTERVIEW_GRANTED',
      CLIENT_SUBMITTED: 'CLIENT_SUBMITTED',
      ACKNOWLEDGED: 'RESPONDED',
      RATE_TOO_HIGH: 'RATE_REJECTED',
      NOT_A_MATCH: 'SKILL_MISMATCH',
      NO_THIRD_PARTY: 'BLOCKER_NO_C2C',
      POSITION_CLOSED: 'POSITION_CLOSED',
    };

    const feedbackType = feedbackTypeMap[classification.type];
    if (!feedbackType || !submission.vendorDomain) return;

    await this.prisma.vendorFeedbackEvent.create({
      data: {
        vendorDomain: submission.vendorDomain,
        feedbackType,
        details: {
          submissionId: submission.id,
          responseType: classification.type,
          confidence: classification.confidence,
          autoDetected: true,
        },
      },
    });
  }
}
