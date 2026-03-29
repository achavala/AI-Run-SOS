import type { PrismaClient } from "@prisma/client";

const INTERVIEW_PATTERNS = [
  /\b(schedule|set\s+up|book)\s+(an?\s+)?(technical\s+)?(interview|screen|call|round|meeting)\b/i,
  /\b(interview|screen)\s+(is\s+)?(scheduled|confirmed|set)\s+(for|on)\b/i,
  /\bplease\s+(share|provide|send)\s+(your|the\s+candidate'?s?)\s+(availability|calendar)\b/i,
  /\bwhen\s+(is|are)\s+(he|she|they|the\s+candidate)\s+available\s+(for|to)\b/i,
  /\b(teams|zoom|webex|google\s+meet)\s+(link|meeting|call|invite)\b/i,
  /\b(first|second|third|final|technical|hr|manager)\s+(round|interview|screen)\b/i,
  /\bavailable\s+for\s+(a\s+)?(quick\s+)?(chat|call|discussion|interview)\b/i,
  /\binterview\s+details?\s*(:|below|attached|follows)\b/i,
];

const OFFER_PATTERNS = [
  /\b(offer|compensation)\s+(letter|package|details)\b/i,
  /\bwe('d|\s+would)\s+like\s+to\s+(offer|extend)\b/i,
  /\bselected\s+for\s+(the\s+)?(position|role|opportunity)\b/i,
  /\bplease\s+(review|sign)\s+(the\s+)?(offer|letter|contract)\b/i,
  /\bstart\s+date\s*(:|is)\s*\d/i,
  /\bcongratulations/i,
  /\bannual\s+(salary|compensation|package)\s*(of|:)\s*\$?\d/i,
  /\bbill\s+rate\s+approved\s+at\b/i,
];

interface DetectedEvent {
  type: "INTERVIEW" | "OFFER";
  confidence: number;
  matchedPattern: string;
  emailId: string;
  submissionId: string;
}

export async function handleInterviewDetection(
  prisma: PrismaClient,
  _data: Record<string, unknown>
): Promise<void> {
  // Find emails from last 24h that haven't been processed for interview/offer detection
  const recentEmails = await prisma.rawEmailMessage.findMany({
    where: {
      sentAt: { gte: new Date(Date.now() - 24 * 3600_000) },
      processed: true,
    },
    select: {
      id: true,
      fromEmail: true,
      subject: true,
      bodyText: true,
      sentAt: true,
      conversationId: true,
    },
    orderBy: { sentAt: "desc" },
    take: 200,
  });

  if (recentEmails.length === 0) return;

  const detected: DetectedEvent[] = [];

  for (const email of recentEmails) {
    const text = [email.subject, email.bodyText].filter(Boolean).join(" ").slice(0, 5000);
    if (!text) continue;

    // Try to match to a submission
    const submission = await matchToSubmission(prisma, email);
    if (!submission) continue;

    // Check for interview signals
    for (const pattern of INTERVIEW_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        detected.push({
          type: "INTERVIEW",
          confidence: 0.85,
          matchedPattern: match[0],
          emailId: email.id,
          submissionId: submission.id,
        });
        break;
      }
    }

    // Check for offer signals
    for (const pattern of OFFER_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        detected.push({
          type: "OFFER",
          confidence: 0.8,
          matchedPattern: match[0],
          emailId: email.id,
          submissionId: submission.id,
        });
        break;
      }
    }
  }

  // Process detected events
  for (const event of detected) {
    const submission = await prisma.submission.findUnique({
      where: { id: event.submissionId },
      select: { id: true, status: true, tenantId: true, consultantId: true, jobId: true },
    });

    if (!submission) continue;

    const statusOrder = ["DRAFT", "CONSENT_PENDING", "SUBMITTED", "INTERVIEWING", "OFFERED", "ACCEPTED"];
    const currentIdx = statusOrder.indexOf(submission.status);

    if (event.type === "INTERVIEW" && currentIdx < statusOrder.indexOf("INTERVIEWING")) {
      await prisma.submission.update({
        where: { id: event.submissionId },
        data: { status: "INTERVIEWING" },
      });

      await prisma.interview.create({
        data: {
          tenantId: submission.tenantId,
          submissionId: submission.id,
          scheduledAt: new Date(Date.now() + 48 * 3600_000),
          status: "SCHEDULED",
          interviewType: "email-detection",
          interviewerFeedback: `Auto-detected from email pattern: "${event.matchedPattern}"`,
        },
      });
    }

    if (event.type === "OFFER" && currentIdx < statusOrder.indexOf("OFFERED")) {
      const sub = await prisma.submission.findUnique({
        where: { id: event.submissionId },
        include: { job: { select: { vendorId: true } } },
      });

      if (sub) {
        await prisma.submission.update({
          where: { id: event.submissionId },
          data: { status: "OFFERED" },
        });

        await prisma.offer.create({
          data: {
            tenantId: sub.tenantId,
            submissionId: sub.id,
            consultantId: sub.consultantId,
            jobId: sub.jobId,
            vendorId: sub.job.vendorId,
            billRate: 0,
            payRate: 0,
            status: "EXTENDED",
            notes: `Auto-detected from email pattern: "${event.matchedPattern}"`,
          },
        });
      }
    }

    // Log the detection event
    await prisma.submissionEvent.create({
      data: {
        submissionId: event.submissionId,
        eventType: event.type === "INTERVIEW" ? "INTERVIEW_DETECTED" : "OFFER_DETECTED",
        actor: "interview-detector",
        details: {
          sourceEmailId: event.emailId,
          confidence: event.confidence,
          matchedPattern: event.matchedPattern,
          automated: true,
        },
      },
    });
  }

  if (detected.length > 0) {
    console.log(
      `[interview-detection] Detected ${detected.filter((d) => d.type === "INTERVIEW").length} interviews, ${detected.filter((d) => d.type === "OFFER").length} offers`
    );
  }
}

async function matchToSubmission(prisma: PrismaClient, email: any): Promise<any | null> {
  if (email.conversationId) {
    const match = await prisma.submission.findFirst({
      where: {
        sentConversationId: email.conversationId,
        status: { in: ["SUBMITTED", "INTERVIEWING", "OFFERED"] },
      },
      select: { id: true },
    });
    if (match) return match;
  }

  if (email.subject && email.fromEmail) {
    const senderDomain = email.fromEmail.split("@")[1]?.toLowerCase();
    if (!senderDomain) return null;

    const bySubject = await prisma.$queryRaw<any[]>`
      SELECT s.id
      FROM "Submission" s
      JOIN "Job" j ON j.id = s."jobId"
      JOIN "Vendor" v ON v.id = j."vendorId"
      WHERE s."sentSubject" IS NOT NULL
        AND s.status IN ('SUBMITTED', 'INTERVIEWING', 'OFFERED')
        AND (${email.subject}::text ILIKE '%' || s."sentSubject" || '%')
        AND v.domain = ${senderDomain}
      ORDER BY s."sentAt" DESC
      LIMIT 1
    `;
    if (bySubject.length > 0) return bySubject[0];
  }

  return null;
}
