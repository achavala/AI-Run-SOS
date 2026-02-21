import { BaseAgent } from "../agent.js";
import type { AgentContext, AgentResult } from "../types.js";

/**
 * JobIntakeAgent — takes raw JD text, parses it into structured fields,
 * computes closure likelihood, and creates/updates job records.
 */
export class JobIntakeAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    this.resetCallLog();

    const rawJd = (context.input["jobDescription"] as string) ?? "";
    const client = (context.input["client"] as string) ?? "";
    const vendorId = (context.input["vendorId"] as string) ?? "";

    if (!rawJd) {
      return this.buildResult(false, {
        error: "No job description text provided",
      });
    }

    const parsed = this.parseJobDescription(rawJd);

    if (vendorId) {
      const vendorResult = await this.callTool(
        "vendor.query",
        { vendorId },
        `Querying vendor ${vendorId} to validate job source`,
        context.workflowId
      );

      if (vendorResult.success) {
        const vendors = (vendorResult.output["vendors"] as Array<Record<string, unknown>>) ?? [];
        if (vendors.length > 0) {
          parsed.vendorTrustScore = (vendors[0]!["trustScore"] as number) ?? 0;
        }
      }
    }

    const closureLikelihood = this.computeClosureLikelihood(parsed);

    const createResult = await this.callTool(
      "job.create",
      {
        title: parsed.title,
        client,
        skills: parsed.skills,
        rate: parsed.rate,
        duration: parsed.duration,
        location: parsed.location,
        description: rawJd,
        closureLikelihood,
      },
      `Creating job from parsed JD: "${parsed.title}" for ${client}`,
      context.workflowId
    );

    if (!createResult.success) {
      if (createResult.status === "escalated") {
        return this.buildResult(false, createResult.output, {
          reason: "Job creation requires approval",
          context: { parsed, client },
        });
      }
      return this.buildResult(false, {
        error: "Failed to create job",
        details: createResult.output,
      });
    }

    const jobId = createResult.output["jobId"] as string;

    if (closureLikelihood < 0.3) {
      await this.callTool(
        "job.update",
        { jobId, status: "low_priority", closureLikelihood },
        `Flagging job ${jobId} as low priority (closure likelihood: ${closureLikelihood})`,
        context.workflowId
      );
    }

    return this.buildResult(true, {
      jobId,
      parsed,
      closureLikelihood,
      status: closureLikelihood < 0.3 ? "low_priority" : "draft",
    });
  }

  private parseJobDescription(rawJd: string): ParsedJob {
    const lines = rawJd.split("\n").map((l) => l.trim()).filter(Boolean);
    const title = lines[0] ?? "Untitled Position";

    const skillKeywords = [
      "javascript", "typescript", "react", "angular", "vue", "node",
      "python", "java", "c#", ".net", "aws", "azure", "gcp",
      "docker", "kubernetes", "sql", "nosql", "mongodb", "postgres",
      "go", "rust", "ruby", "php", "swift", "kotlin",
    ];

    const lowerJd = rawJd.toLowerCase();
    const skills = skillKeywords.filter((kw) => lowerJd.includes(kw));

    const rateMatch = rawJd.match(/\$(\d+)\s*(?:\/\s*hr|per\s*hour|hourly)/i);
    const rate = rateMatch ? parseInt(rateMatch[1]!, 10) : null;

    const durationMatch = rawJd.match(/(\d+)\s*(?:months?|mos?)/i);
    const duration = durationMatch ? parseInt(durationMatch[1]!, 10) : null;

    const locationMatch = rawJd.match(
      /(?:location|based in|onsite|hybrid|remote)[:\s]+([^\n,]+)/i
    );
    const location = locationMatch ? locationMatch[1]!.trim() : "remote";

    return { title, skills, rate, duration, location };
  }

  private computeClosureLikelihood(parsed: ParsedJob): number {
    let score = 0.5;

    if (parsed.skills.length >= 3) score += 0.1;
    if (parsed.skills.length >= 5) score += 0.05;

    if (parsed.rate !== null) {
      if (parsed.rate >= 80 && parsed.rate <= 150) score += 0.15;
      else if (parsed.rate > 150) score += 0.05;
    }

    if (parsed.duration !== null) {
      if (parsed.duration >= 6) score += 0.1;
      else if (parsed.duration >= 3) score += 0.05;
    }

    if (parsed.vendorTrustScore !== undefined) {
      score += parsed.vendorTrustScore * 0.1;
    }

    return Math.min(score, 1.0);
  }
}

interface ParsedJob {
  title: string;
  skills: string[];
  rate: number | null;
  duration: number | null;
  location: string;
  vendorTrustScore?: number;
}
