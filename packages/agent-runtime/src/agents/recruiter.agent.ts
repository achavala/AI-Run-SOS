import { BaseAgent } from "../agent.js";
import type { AgentContext, AgentResult } from "../types.js";

/**
 * TalentSourcingAgent — searches consultants by skills, builds shortlists,
 * and returns ranked matches for a given job requirement.
 */
export class RecruiterAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    this.resetCallLog();

    const skills = (context.input["skills"] as string[]) ?? [];
    const location = (context.input["location"] as string) ?? "any";
    const jobId = (context.input["jobId"] as string) ?? "";
    const maxResults = (context.input["maxResults"] as number) ?? 10;

    if (skills.length === 0) {
      return this.buildResult(false, {
        error: "No skills provided for talent search",
      });
    }

    const searchResult = await this.callTool(
      "consultant.search",
      { skills, location, maxResults },
      `Searching for consultants with skills: [${skills.join(", ")}] in ${location}`,
      context.workflowId
    );

    if (!searchResult.success) {
      if (searchResult.status === "escalated") {
        return this.buildResult(false, searchResult.output, {
          reason: "Consultant search requires approval",
          context: { skills, location },
        });
      }
      return this.buildResult(false, {
        error: "Consultant search failed",
        details: searchResult.output,
      });
    }

    const consultants = (searchResult.output["consultants"] as Array<Record<string, unknown>>) ?? [];

    if (consultants.length === 0) {
      return this.buildResult(true, {
        message: "No consultants found matching criteria",
        skills,
        location,
        matches: [],
      });
    }

    const rankedConsultants = consultants
      .map((c) => {
        const matchScore = this.computeMatchScore(c, skills);
        return { ...c, matchScore } as Record<string, unknown>;
      })
      .sort((a, b) => (a["matchScore"] as number) - (b["matchScore"] as number))
      .reverse();

    const topIds = rankedConsultants.map((c) => c["id"] as string);

    const shortlistResult = await this.callTool(
      "consultant.shortlist",
      { consultantIds: topIds, jobId },
      `Creating shortlist of ${topIds.length} candidates for job ${jobId}`,
      context.workflowId
    );

    if (!shortlistResult.success) {
      return this.buildResult(true, {
        message: "Search succeeded but shortlist creation failed",
        rankedConsultants,
        shortlistError: shortlistResult.output,
      });
    }

    return this.buildResult(true, {
      shortlistId: shortlistResult.output["shortlistId"],
      jobId,
      rankedConsultants,
      totalMatches: searchResult.output["totalMatches"],
    });
  }

  private computeMatchScore(
    consultant: Record<string, unknown>,
    requiredSkills: string[]
  ): number {
    const consultantSkills = (consultant["skills"] as string[]) ?? [];
    const skillMatch =
      requiredSkills.length > 0
        ? consultantSkills.filter((s) =>
            requiredSkills.some(
              (rs) => rs.toLowerCase() === s.toLowerCase()
            )
          ).length / requiredSkills.length
        : 0;

    const rating = (consultant["rating"] as number) ?? 0;
    const ratingScore = rating / 5.0;

    return skillMatch * 0.7 + ratingScore * 0.3;
  }
}
