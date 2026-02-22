import type { PrismaClient } from "@prisma/client";
import { SubmissionStatus, CommChannel, CommDirection } from "@prisma/client";

export async function handleFollowupCheck(
  prisma: PrismaClient,
  _data: Record<string, unknown>
): Promise<{ actionsTaken: string[] }> {
  const actionsTaken: string[] = [];

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
  const fiveDaysAgo = new Date();
  fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

  // Submissions SUBMITTED but no feedback for > 3 days
  const submittedNoFeedback = await prisma.submission.findMany({
    where: {
      status: SubmissionStatus.SUBMITTED,
      feedbackReceivedAt: null,
      createdAt: { lt: threeDaysAgo },
    },
    include: { job: true, consultant: true },
  });

  for (const sub of submittedNoFeedback) {
    const existing = await prisma.communicationEvent.findFirst({
      where: {
        entityType: "Submission",
        entityId: sub.id,
        subject: { contains: "Follow-up: No feedback" },
        createdAt: { gte: threeDaysAgo },
      },
    });
    if (!existing) {
      await prisma.communicationEvent.create({
        data: {
          tenantId: sub.tenantId,
          entityType: "Submission",
          entityId: sub.id,
          channel: CommChannel.INTERNAL_NOTE,
          direction: CommDirection.INTERNAL,
          subject: `Follow-up: No feedback for submission (job: ${sub.job.title})`,
          body: `Submission ${sub.id} has been SUBMITTED for >3 days with no vendor feedback. Consider following up.`,
          sentByAgent: true,
          agentId: "followup-check-worker",
        },
      });
      actionsTaken.push(`Created followup for submission ${sub.id} (no feedback >3d)`);
    }
  }

  // Submissions INTERVIEWING but no update for > 5 days
  const interviewingStale = await prisma.submission.findMany({
    where: {
      status: SubmissionStatus.INTERVIEWING,
      updatedAt: { lt: fiveDaysAgo },
    },
    include: { job: true, consultant: true },
  });

  for (const sub of interviewingStale) {
    const existing = await prisma.communicationEvent.findFirst({
      where: {
        entityType: "Submission",
        entityId: sub.id,
        subject: { contains: "Follow-up: Interviewing" },
        createdAt: { gte: fiveDaysAgo },
      },
    });
    if (!existing) {
      await prisma.communicationEvent.create({
        data: {
          tenantId: sub.tenantId,
          entityType: "Submission",
          entityId: sub.id,
          channel: CommChannel.INTERNAL_NOTE,
          direction: CommDirection.INTERNAL,
          subject: `Follow-up: Interviewing status stale (job: ${sub.job.title})`,
          body: `Submission ${sub.id} has been INTERVIEWING for >5 days with no update. Consider following up.`,
          sentByAgent: true,
          agentId: "followup-check-worker",
        },
      });
      actionsTaken.push(`Created followup for submission ${sub.id} (interviewing stale >5d)`);
    }
  }

  return { actionsTaken };
}
