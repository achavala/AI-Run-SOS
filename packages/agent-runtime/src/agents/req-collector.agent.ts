import { BaseAgent } from "../agent.js";
import type { AgentContext, AgentResult } from "../types.js";

type Pod = "SWE" | "CLOUD_DEVOPS" | "DATA" | "CYBER";
type SourceType = "EMAIL" | "PORTAL" | "MANUAL";

interface ParsedReqFields {
  title: string;
  skills: string[];
  location: string;
  rateRange: { min: number | null; max: number | null };
  duration: string | null;
  startDate: string | null;
  requirements: string[];
}

const POD_SKILL_MAP: Record<Pod, string[]> = {
  SWE: ["java", "node", "nodejs", "node.js", ".net", "c#", "react", "angular", "vue", "typescript", "javascript", "python", "go", "ruby", "php", "spring", "django", "flask", "express", "next.js", "nuxt"],
  CLOUD_DEVOPS: ["kubernetes", "k8s", "terraform", "ci/cd", "ci-cd", "jenkins", "github actions", "aws", "azure", "gcp", "docker", "ansible", "puppet", "chef", "cloudformation", "helm", "argo", "devops", "sre"],
  DATA: ["snowflake", "spark", "dbt", "airflow", "kafka", "databricks", "bigquery", "redshift", "etl", "data engineering", "data pipeline", "machine learning", "ml", "pandas", "sql", "tableau", "power bi", "looker"],
  CYBER: ["siem", "soc", "iam", "identity", "penetration testing", "pentest", "vulnerability", "firewall", "zero trust", "compliance", "cissp", "cism", "security", "infosec", "devsecops", "splunk", "crowdstrike"],
};

const DEDUP_WINDOW_DAYS = 7;

/**
 * ReqCollector — JD Intake Swarm agent that parses raw job text from emails/portals,
 * assigns pods based on skills, deduplicates against existing reqs, and creates jobs.
 */
export class ReqCollectorAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    this.resetCallLog();

    const rawText = (context.input["rawText"] as string) ?? "";
    const sourceType = (context.input["sourceType"] as SourceType) ?? "MANUAL";
    const vendorId = (context.input["vendorId"] as string) ?? "";

    if (!rawText) {
      return this.buildResult(false, {
        error: "rawText is required — provide the email or JD content",
      });
    }

    let textToParse = rawText;

    if (sourceType === "EMAIL") {
      const parseResult = await this.callTool(
        "email.parse",
        { rawText },
        "Parsing email to extract job description content",
        context.workflowId
      );

      if (parseResult.success) {
        textToParse = (parseResult.output["body"] as string) ?? rawText;
      }
    }

    const parsedFields = this.parseRawText(textToParse);

    const pod = this.assignPod(parsedFields.skills);

    let vendorName = "";
    if (vendorId) {
      const vendorResult = await this.callTool(
        "vendor.query",
        { vendorId },
        `Validating vendor ${vendorId}`,
        context.workflowId
      );

      if (vendorResult.success) {
        const vendors = (vendorResult.output["vendors"] as Array<Record<string, unknown>>) ?? [];
        if (vendors.length > 0) {
          vendorName = (vendors[0]!["name"] as string) ?? "";
        }
      }
    }

    const dedupResult = await this.callTool(
      "job.dedup",
      {
        vendorId,
        title: parsedFields.title,
        skills: parsedFields.skills,
        windowDays: DEDUP_WINDOW_DAYS,
      },
      `Checking for duplicate jobs: "${parsedFields.title}" from vendor ${vendorId || "unknown"}`,
      context.workflowId
    );

    const isDuplicate = dedupResult.success
      ? (dedupResult.output["isDuplicate"] as boolean) ?? false
      : false;
    const existingJobId = dedupResult.success
      ? (dedupResult.output["existingJobId"] as string) ?? null
      : null;

    if (isDuplicate && existingJobId) {
      const updateResult = await this.callTool(
        "job.update",
        {
          jobId: existingJobId,
          mergedFrom: { rawText, sourceType, vendorId, parsedAt: new Date().toISOString() },
          skills: parsedFields.skills,
          rateRange: parsedFields.rateRange,
          location: parsedFields.location,
        },
        `Merging into existing job ${existingJobId}`,
        context.workflowId
      );

      const queryResult = await this.callTool(
        "job.query",
        { jobId: existingJobId },
        `Querying merged job ${existingJobId} for freshness`,
        context.workflowId
      );

      const freshnessScore = queryResult.success
        ? (queryResult.output["freshnessScore"] as number) ?? 0.8
        : 0.8;

      return this.buildResult(true, {
        jobId: existingJobId,
        isDuplicate: true,
        parsedFields,
        pod,
        freshnessScore,
        vendorName,
        merged: updateResult.success,
      });
    }

    const createResult = await this.callTool(
      "job.create",
      {
        title: parsedFields.title,
        skills: parsedFields.skills,
        location: parsedFields.location,
        rateRange: parsedFields.rateRange,
        duration: parsedFields.duration,
        startDate: parsedFields.startDate,
        requirements: parsedFields.requirements,
        pod,
        vendorId,
        sourceType,
        status: "NEW",
        rawText,
        createdAt: new Date().toISOString(),
      },
      `Creating new job: "${parsedFields.title}" in pod ${pod}`,
      context.workflowId
    );

    if (!createResult.success) {
      return this.buildResult(false, {
        error: "Failed to create job",
        details: createResult.output,
        parsedFields,
        pod,
      });
    }

    const jobId = (createResult.output["jobId"] as string) ?? "";

    return this.buildResult(true, {
      jobId,
      isDuplicate: false,
      parsedFields,
      pod,
      freshnessScore: 1.0,
      vendorName,
    });
  }

  private parseRawText(text: string): ParsedReqFields {
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const title = lines[0] ?? "Untitled Position";
    const lowerText = text.toLowerCase();

    const skills: string[] = [];
    const allSkills = Object.values(POD_SKILL_MAP).flat();
    for (const skill of allSkills) {
      if (lowerText.includes(skill) && !skills.includes(skill)) {
        skills.push(skill);
      }
    }

    const locationMatch = text.match(
      /(?:location|based in|onsite|hybrid|remote)[:\s]+([^\n,;]+)/i
    );
    const location = locationMatch ? locationMatch[1]!.trim() : "remote";

    const rateMinMatch = text.match(/\$(\d+)\s*(?:[-–to]+)\s*\$?(\d+)\s*(?:\/\s*hr|per\s*hour|hourly)/i);
    const rateSingleMatch = text.match(/\$(\d+)\s*(?:\/\s*hr|per\s*hour|hourly)/i);

    let rateRange: { min: number | null; max: number | null };
    if (rateMinMatch) {
      rateRange = {
        min: parseInt(rateMinMatch[1]!, 10),
        max: parseInt(rateMinMatch[2]!, 10),
      };
    } else if (rateSingleMatch) {
      rateRange = {
        min: parseInt(rateSingleMatch[1]!, 10),
        max: null,
      };
    } else {
      rateRange = { min: null, max: null };
    }

    const durationMatch = text.match(/(\d+)\s*(?:months?|mos?)\b/i);
    const duration = durationMatch ? `${durationMatch[1]} months` : null;

    const startMatch = text.match(
      /(?:start\s*date|starting)[:\s]+([^\n,;]+)/i
    );
    const startDate = startMatch ? startMatch[1]!.trim() : null;

    const requirements: string[] = [];
    const reqPatterns = [
      /(?:requirements?|qualifications?|must.have)[:\s]*\n?([\s\S]*?)(?:\n\n|\n[A-Z]|$)/i,
    ];
    for (const pattern of reqPatterns) {
      const match = text.match(pattern);
      if (match?.[1]) {
        const items = match[1]
          .split(/\n/)
          .map((l) => l.replace(/^[-•*]\s*/, "").trim())
          .filter((l) => l.length > 0);
        requirements.push(...items);
      }
    }

    return { title, skills, location, rateRange, duration, startDate, requirements };
  }

  private assignPod(skills: string[]): Pod {
    const lowerSkills = skills.map((s) => s.toLowerCase());
    const podScores: Record<Pod, number> = { SWE: 0, CLOUD_DEVOPS: 0, DATA: 0, CYBER: 0 };

    for (const [pod, podSkills] of Object.entries(POD_SKILL_MAP) as Array<[Pod, string[]]>) {
      for (const skill of lowerSkills) {
        if (podSkills.includes(skill)) {
          podScores[pod]++;
        }
      }
    }

    const sorted = (Object.entries(podScores) as Array<[Pod, number]>).sort(
      (a, b) => b[1] - a[1]
    );

    return sorted[0]![1] > 0 ? sorted[0]![0] : "SWE";
  }
}
