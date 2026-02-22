import { BaseAgent } from "../agent.js";
import type { AgentContext, AgentResult } from "../types.js";

type Pod = "SWE" | "CLOUD_DEVOPS" | "DATA" | "CYBER";

interface BenchCandidate {
  consultantId: string;
  name: string;
  pod: Pod;
  skills: string[];
  trustScore: number;
  daysAvailable: number;
  readinessStatus: string;
  benchScore: number;
}

interface SkillGap {
  jobId: string;
  title: string;
  pod: Pod;
  missingSkills: string[];
  reqCount: number;
}

interface NurtureTarget {
  consultantId: string;
  name: string;
  pod: Pod;
  currentStatus: string;
  missingForReady: string[];
  recommendation: string;
}

const ALL_PODS: Pod[] = ["SWE", "CLOUD_DEVOPS", "DATA", "CYBER"];

/**
 * SupplyRadar — Recruiting Strategist agent that monitors the consultant bench,
 * identifies skill gaps against active jobs, and generates nurture recommendations.
 */
export class SupplyRadarAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    this.resetCallLog();

    const hotBench: BenchCandidate[] = [];
    const allReadyCandidates: Array<Record<string, unknown>> = [];

    for (const pod of ALL_PODS) {
      const searchResult = await this.callTool(
        "consultant.search",
        { pod, readinessStatus: "SUBMISSION_READY" },
        `Searching SUBMISSION_READY consultants in pod ${pod}`,
        context.workflowId
      );

      if (!searchResult.success) continue;

      const consultants = (searchResult.output["consultants"] as Array<Record<string, unknown>>) ?? [];
      allReadyCandidates.push(...consultants);

      for (const c of consultants) {
        const consultantId = (c["id"] as string) ?? "";

        const detailResult = await this.callTool(
          "consultant.read",
          { consultantId },
          `Reading details for consultant ${consultantId}`,
          context.workflowId
        );

        const detail = detailResult.success ? detailResult.output : c;
        const skills = (detail["skills"] as string[]) ?? [];
        const trustScore = (detail["trustScore"] as number) ?? 0;
        const daysAvailable = (detail["daysAvailable"] as number) ?? 0;
        const skillsMatchFactor = skills.length > 0 ? Math.min(skills.length / 5, 1.0) : 0;
        const benchScore = skillsMatchFactor * trustScore * Math.max(1, daysAvailable);

        hotBench.push({
          consultantId,
          name: (detail["name"] as string) ?? "",
          pod,
          skills,
          trustScore,
          daysAvailable,
          readinessStatus: "SUBMISSION_READY",
          benchScore,
        });
      }
    }

    hotBench.sort((a, b) => b.benchScore - a.benchScore);

    const jobsResult = await this.callTool(
      "job.query",
      { status: "active" },
      "Querying all active jobs to identify skill gaps",
      context.workflowId
    );

    const jobs = jobsResult.success
      ? (jobsResult.output["jobs"] as Array<Record<string, unknown>>) ?? []
      : [];

    const readySkillSet = new Set(
      allReadyCandidates.flatMap((c) => ((c["skills"] as string[]) ?? []).map((s) => s.toLowerCase()))
    );

    const skillGaps: SkillGap[] = [];

    for (const job of jobs) {
      const requiredSkills = (job["skills"] as string[]) ?? [];
      const missing = requiredSkills.filter((s) => !readySkillSet.has(s.toLowerCase()));

      if (missing.length > 0) {
        skillGaps.push({
          jobId: (job["id"] as string) ?? "",
          title: (job["title"] as string) ?? "",
          pod: (job["pod"] as Pod) ?? "SWE",
          missingSkills: missing,
          reqCount: 1,
        });
      }
    }

    const nurtureTargets: NurtureTarget[] = [];

    for (const pod of ALL_PODS) {
      const verifiedResult = await this.callTool(
        "consultant.search",
        { pod, readinessStatus: "VERIFIED" },
        `Searching VERIFIED consultants in pod ${pod} for nurture recommendations`,
        context.workflowId
      );

      if (!verifiedResult.success) continue;

      const verified = (verifiedResult.output["consultants"] as Array<Record<string, unknown>>) ?? [];

      for (const c of verified) {
        const missingForReady = this.identifyReadinessGaps(c);

        if (missingForReady.length > 0) {
          nurtureTargets.push({
            consultantId: (c["id"] as string) ?? "",
            name: (c["name"] as string) ?? "",
            pod,
            currentStatus: "VERIFIED",
            missingForReady,
            recommendation: this.buildNurtureRecommendation(missingForReady),
          });
        }
      }
    }

    const analyticsResult = await this.callTool(
      "submission.analytics",
      { period: "7d" },
      "Getting submission analytics for bench summary",
      context.workflowId
    );

    const recentSubmissions = analyticsResult.success
      ? (analyticsResult.output["totalSubmissions"] as number) ?? 0
      : 0;

    const benchSummary = {
      totalReady: hotBench.length,
      byPod: ALL_PODS.map((pod) => ({
        pod,
        ready: hotBench.filter((c) => c.pod === pod).length,
      })),
      skillGapsCount: skillGaps.length,
      nurtureCount: nurtureTargets.length,
      recentSubmissions,
    };

    return this.buildResult(true, {
      hotBench,
      skillGaps,
      nurtureTargets,
      benchSummary,
    });
  }

  private identifyReadinessGaps(consultant: Record<string, unknown>): string[] {
    const gaps: string[] = [];

    const hasResume = (consultant["hasResume"] as boolean) ?? false;
    const hasSkillsVerified = (consultant["skillsVerified"] as boolean) ?? false;
    const hasBackgroundCheck = (consultant["backgroundCheck"] as boolean) ?? false;
    const hasAvailability = (consultant["availabilityConfirmed"] as boolean) ?? false;

    if (!hasResume) gaps.push("resume_upload");
    if (!hasSkillsVerified) gaps.push("skills_verification");
    if (!hasBackgroundCheck) gaps.push("background_check");
    if (!hasAvailability) gaps.push("availability_confirmation");

    return gaps;
  }

  private buildNurtureRecommendation(gaps: string[]): string {
    const actions: Record<string, string> = {
      resume_upload: "Request updated resume",
      skills_verification: "Schedule skills assessment",
      background_check: "Initiate background check",
      availability_confirmation: "Confirm current availability and start date",
    };

    return gaps.map((g) => actions[g] ?? `Complete: ${g}`).join("; ");
  }
}
