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

  /**
   * Runs every 5 minutes: scans recent inbound emails, matches to active
   * submissions by conversationId or subject+sender, classifies, and
   * auto-updates submission status.
   */
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
    // Find recent inbound emails that haven't been processed for response detection
    let unprocessed: any[] = [];
    try {
      unprocessed = await this.prisma.$queryRaw`
        SELECT 
          rem.id,
          rem."fromEmail",
          rem.subject,
          rem."bodyText" as "bodyPreview",
          rem."bodyText",
          rem."sentAt",
          rem.conversation_id as "conversationId",
          rem.internet_message_id as "internetMessageId"
        FROM "RawEmailMessage" rem
        WHERE rem."sentAt" >= NOW() - interval '24 hours'
          AND rem.category IN ('vendor_req', 'vendor_reply', 'general')
          AND rem.processed = true
          AND NOT EXISTS (
            SELECT 1 FROM submission_event se
            WHERE se.details->>'sourceEmailId' = rem.id::text
              AND se.event_type LIKE 'RESPONSE_%'
          )
        ORDER BY rem."sentAt" DESC
        LIMIT 100
      ` as any[];
    } catch {
      // RawEmailMessage may lack category/conversation_id/internet_message_id columns
    }

    if (unprocessed.length === 0) return;

    this.logger.log(`Scanning ${unprocessed.length} inbound emails for submission responses`);

    let matched = 0;
    let updated = 0;

    for (const email of unprocessed) {
      // Try to match this email to an active submission
      const submission = await this.matchEmailToSubmission(email);
      if (!submission) continue;
      matched++;

      const bodyToClassify = (email.bodyText || email.bodyPreview || email.subject || '').slice(0, 3000);
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
    // Strategy 1: Match by conversationId (most reliable)
    if (email.conversationId) {
      const byConversation = await this.prisma.$queryRaw`
        SELECT s.id, s.status, s."tenantId", s."jobId", s."consultantId",
               j."vendorId", v."companyName" as "vendorName", v.domain as "vendorDomain"
        FROM "Submission" s
        JOIN "Job" j ON j.id = s."jobId"
        JOIN "Vendor" v ON v.id = j."vendorId"
        WHERE s."sentConversationId" = ${email.conversationId}
          AND s.status IN ('SUBMITTED', 'CONSENT_PENDING', 'INTERVIEWING')
        LIMIT 1
      ` as any[];

      if (byConversation.length > 0) return byConversation[0];
    }

    // Strategy 2: Match by subject line + sender domain
    if (email.subject && email.fromEmail) {
      const senderDomain = email.fromEmail.split('@')[1]?.toLowerCase();
      if (!senderDomain) return null;

      const bySubjectDomain = await this.prisma.$queryRaw`
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
      ` as any[];

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

    // Record the email thread entry
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
        bodyPreview: (email.bodyPreview || '').slice(0, 500),
        sentAt: new Date(email.sentAt),
      },
    });

    // Log the response detection event
    await this.prisma.$executeRaw`
      INSERT INTO submission_event (submission_id, event_type, actor, details)
      VALUES (
        ${submission.id},
        ${'RESPONSE_' + classification.type},
        'response-detector',
        ${JSON.stringify({
          sourceEmailId: email.id,
          fromEmail: email.fromEmail,
          responseType: classification.type,
          confidence: classification.confidence,
          matchedPattern: classification.matchedPattern,
          automated: true,
        })}::jsonb
      )
    `;

    // Auto-update submission status for high-confidence terminal events
    if (newStatus && classification.confidence >= 0.8) {
      await this.prisma.submission.update({
        where: { id: submission.id },
        data: {
          status: newStatus as any,
          vendorFeedback: `[auto-detected] ${classification.type}: "${classification.matchedPattern}"`,
          feedbackReceivedAt: new Date(),
        },
      });

      // Cancel pending follow-ups on terminal statuses
      if (['CLOSED', 'REJECTED'].includes(newStatus)) {
        try {
          await this.prisma.$executeRaw`
            UPDATE submission_followup SET status = 'CANCELLED'
            WHERE submission_id = ${submission.id} AND status = 'PENDING'
          `;
        } catch {
          // submission_followup table may not exist
        }
      }

      this.logger.log(
        `Auto-updated submission ${submission.id}: ${submission.status} → ${newStatus} (${classification.type}, confidence: ${classification.confidence})`,
      );
    }

    // Emit trust event for vendor
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

    try {
      await this.prisma.$executeRaw`
        INSERT INTO vendor_feedback_event (vendor_domain, feedback_type, details, created_at)
        VALUES (
          ${submission.vendorDomain},
          ${feedbackType},
          ${JSON.stringify({
            submissionId: submission.id,
            responseType: classification.type,
            confidence: classification.confidence,
            autoDetected: true,
          })}::jsonb,
          NOW()
        )
      `;
    } catch {
      // vendor_feedback_event table does not exist
    }
  }
}
