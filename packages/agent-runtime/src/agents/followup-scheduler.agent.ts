import { BaseAgent } from "../agent.js";
import type { AgentContext, AgentResult } from "../types.js";

type FollowupType = "friendly_checkin" | "professional_reminder" | "escalation_notice";
type SubmissionStage = "SUBMITTED" | "INTERVIEWING" | "OFFERED";

interface FollowupItem {
  submissionId: string;
  consultantName: string;
  vendorName: string;
  jobTitle: string;
  stage: SubmissionStage;
  daysSinceLastAction: number;
  followupNumber: number;
  followupType: FollowupType;
  draftSubject: string;
  draftBody: string;
  requiresApproval: boolean;
}

interface InterviewPrep {
  submissionId: string;
  consultantName: string;
  jobTitle: string;
  interviewDate: string;
  interviewType: string;
  prepNotes: string[];
}

const FOLLOWUP_THRESHOLDS: Record<SubmissionStage, number> = {
  SUBMITTED: 3,
  INTERVIEWING: 2,
  OFFERED: 1,
};

/**
 * FollowupSchedulerAgent — monitors submissions needing followup, drafts
 * stage-appropriate emails, generates interview prep kits, and logs all communications.
 */
export class FollowupSchedulerAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    this.resetCallLog();

    const followupsGenerated: FollowupItem[] = [];
    const escalations: Array<Record<string, unknown>> = [];

    const stages: SubmissionStage[] = ["SUBMITTED", "INTERVIEWING", "OFFERED"];

    for (const stage of stages) {
      const threshold = FOLLOWUP_THRESHOLDS[stage];

      const queryResult = await this.callTool(
        "submission.query",
        {
          status: stage,
          daysSinceLastAction: threshold,
          noFeedback: true,
        },
        `Querying ${stage} submissions needing followup (>${threshold} days)`,
        context.workflowId
      );

      if (!queryResult.success) continue;

      const submissions = (queryResult.output["submissions"] as Array<Record<string, unknown>>) ?? [];

      for (const sub of submissions) {
        const submissionId = (sub["id"] as string) ?? "";
        const consultantName = (sub["consultantName"] as string) ?? "";
        const vendorName = (sub["vendorName"] as string) ?? "";
        const jobTitle = (sub["jobTitle"] as string) ?? "";
        const daysSinceLastAction = (sub["daysSinceLastAction"] as number) ?? 0;
        const previousFollowups = (sub["followupCount"] as number) ?? 0;

        const followupNumber = previousFollowups + 1;
        const followupType = this.determineFollowupType(followupNumber);

        const { subject, body } = this.draftFollowupEmail(
          followupType,
          stage,
          consultantName,
          vendorName,
          jobTitle,
          daysSinceLastAction
        );

        const draftResult = await this.callTool(
          "email.draft",
          {
            submissionId,
            to: vendorName,
            subject,
            body,
            followupNumber,
            followupType,
            requiresApproval: true,
          },
          `Drafting ${followupType} for submission ${submissionId}`,
          context.workflowId
        );

        const item: FollowupItem = {
          submissionId,
          consultantName,
          vendorName,
          jobTitle,
          stage,
          daysSinceLastAction,
          followupNumber,
          followupType,
          draftSubject: subject,
          draftBody: body,
          requiresApproval: true,
        };

        followupsGenerated.push(item);

        if (followupType === "escalation_notice") {
          escalations.push({
            submissionId,
            consultantName,
            vendorName,
            jobTitle,
            stage,
            followupNumber,
            daysSinceLastAction,
          });
        }

        await this.callTool(
          "communication.log",
          {
            type: "followup_draft",
            submissionId,
            followupNumber,
            followupType,
            stage,
            draftId: draftResult.output["draftId"] ?? null,
            timestamp: new Date().toISOString(),
          },
          `Logging followup communication for submission ${submissionId}`,
          context.workflowId
        );
      }
    }

    const interviewResult = await this.callTool(
      "interview.query",
      { upcoming: true, days: 7 },
      "Querying upcoming interviews for prep kit generation",
      context.workflowId
    );

    const interviewPreps: InterviewPrep[] = [];

    if (interviewResult.success) {
      const interviews = (interviewResult.output["interviews"] as Array<Record<string, unknown>>) ?? [];

      for (const interview of interviews) {
        const submissionId = (interview["submissionId"] as string) ?? "";
        const consultantName = (interview["consultantName"] as string) ?? "";
        const jobTitle = (interview["jobTitle"] as string) ?? "";
        const interviewDate = (interview["date"] as string) ?? "";
        const interviewType = (interview["type"] as string) ?? "general";
        const jobSkills = (interview["requiredSkills"] as string[]) ?? [];
        const consultantSkills = (interview["consultantSkills"] as string[]) ?? [];
        const clientNotes = (interview["clientNotes"] as string) ?? "";

        const prepNotes = this.generatePrepNotes(
          interviewType,
          jobSkills,
          consultantSkills,
          clientNotes
        );

        interviewPreps.push({
          submissionId,
          consultantName,
          jobTitle,
          interviewDate,
          interviewType,
          prepNotes,
        });

        await this.callTool(
          "communication.log",
          {
            type: "interview_prep",
            submissionId,
            interviewDate,
            prepGenerated: true,
            timestamp: new Date().toISOString(),
          },
          `Logging interview prep generation for ${consultantName}`,
          context.workflowId
        );
      }
    }

    return this.buildResult(
      true,
      {
        followupsGenerated,
        interviewPreps,
        escalations,
        summary: {
          totalFollowups: followupsGenerated.length,
          byStage: {
            SUBMITTED: followupsGenerated.filter((f) => f.stage === "SUBMITTED").length,
            INTERVIEWING: followupsGenerated.filter((f) => f.stage === "INTERVIEWING").length,
            OFFERED: followupsGenerated.filter((f) => f.stage === "OFFERED").length,
          },
          escalationCount: escalations.length,
          interviewPrepsCount: interviewPreps.length,
        },
      },
      escalations.length > 0
        ? {
            reason: `${escalations.length} submissions require escalation — repeated followup with no response`,
            context: { escalations },
          }
        : undefined
    );
  }

  private determineFollowupType(followupNumber: number): FollowupType {
    if (followupNumber <= 1) return "friendly_checkin";
    if (followupNumber === 2) return "professional_reminder";
    return "escalation_notice";
  }

  private draftFollowupEmail(
    type: FollowupType,
    stage: SubmissionStage,
    consultantName: string,
    vendorName: string,
    jobTitle: string,
    daysSince: number
  ): { subject: string; body: string } {
    const stageLabel = this.stageLabel(stage);

    switch (type) {
      case "friendly_checkin":
        return {
          subject: `Checking in: ${consultantName} — ${jobTitle}`,
          body: [
            `Hi ${vendorName} team,`,
            "",
            `Hope you're doing well! Just checking in on the status of ${consultantName}'s ${stageLabel} for the ${jobTitle} position.`,
            "",
            `It's been ${daysSince} days since the last update. Would love to hear if there's any feedback or next steps.`,
            "",
            "Thanks!",
          ].join("\n"),
        };

      case "professional_reminder":
        return {
          subject: `Follow-up: ${consultantName} — ${jobTitle} (${stageLabel})`,
          body: [
            `Hi ${vendorName} team,`,
            "",
            `Following up on ${consultantName}'s ${stageLabel} for the ${jobTitle} role. It has been ${daysSince} days without an update.`,
            "",
            "Could you provide a status update at your earliest convenience? We want to ensure we keep the process moving forward for all parties.",
            "",
            "Thank you for your attention to this.",
          ].join("\n"),
        };

      case "escalation_notice":
        return {
          subject: `Urgent: Status needed — ${consultantName} — ${jobTitle}`,
          body: [
            `Hi ${vendorName} team,`,
            "",
            `This is our third follow-up regarding ${consultantName}'s ${stageLabel} for the ${jobTitle} position. It has been ${daysSince} days with no response.`,
            "",
            "We need a status update within 24 hours. Without a response, we may need to reallocate this candidate to other active requirements.",
            "",
            "Please advise on next steps.",
          ].join("\n"),
        };
    }
  }

  private stageLabel(stage: SubmissionStage): string {
    switch (stage) {
      case "SUBMITTED":
        return "submission";
      case "INTERVIEWING":
        return "interview";
      case "OFFERED":
        return "offer";
    }
  }

  private generatePrepNotes(
    interviewType: string,
    jobSkills: string[],
    consultantSkills: string[],
    clientNotes: string
  ): string[] {
    const notes: string[] = [];

    notes.push(`Interview type: ${interviewType}`);

    const matchingSkills = jobSkills.filter((s) =>
      consultantSkills.some((cs) => cs.toLowerCase() === s.toLowerCase())
    );
    const gapSkills = jobSkills.filter(
      (s) => !consultantSkills.some((cs) => cs.toLowerCase() === s.toLowerCase())
    );

    if (matchingSkills.length > 0) {
      notes.push(`Strong match on: ${matchingSkills.join(", ")}`);
    }

    if (gapSkills.length > 0) {
      notes.push(`Prepare to address: ${gapSkills.join(", ")}`);
    }

    if (clientNotes) {
      notes.push(`Client notes: ${clientNotes}`);
    }

    if (interviewType === "technical") {
      notes.push("Expect coding exercises or system design questions");
    } else if (interviewType === "behavioral") {
      notes.push("Prepare STAR-method examples for past project experiences");
    } else if (interviewType === "panel") {
      notes.push("Multiple interviewers — address each person and maintain engagement");
    }

    return notes;
  }
}
