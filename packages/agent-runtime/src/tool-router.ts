import { v4 as uuidv4 } from "uuid";
import type { ToolCall, ToolHandler, ToolResult } from "./types.js";

export class ToolRouter {
  private tools = new Map<string, ToolHandler>();

  constructor() {
    this.registerBuiltinTools();
  }

  registerTool(name: string, handler: ToolHandler): void {
    this.tools.set(name, handler);
  }

  async execute(toolCall: ToolCall): Promise<ToolResult> {
    const handler = this.tools.get(toolCall.tool);
    if (!handler) {
      return {
        success: false,
        output: { error: `Unknown tool: ${toolCall.tool}` },
        durationMs: 0,
      };
    }

    const start = Date.now();
    try {
      const result = await handler(toolCall.input);
      return { ...result, durationMs: Date.now() - start };
    } catch (err) {
      return {
        success: false,
        output: {
          error: err instanceof Error ? err.message : "Unknown error",
        },
        durationMs: Date.now() - start,
      };
    }
  }

  getRegisteredTools(): string[] {
    return Array.from(this.tools.keys());
  }

  private registerBuiltinTools(): void {
    // ── Consultant tools ───────────────────────────────────────────────
    this.registerTool("consultant.search", async (input) => {
      const skills = (input["skills"] as string[]) ?? [];
      const location = (input["location"] as string) ?? "any";
      return {
        success: true,
        output: {
          consultants: [
            {
              id: uuidv4(),
              name: "Alex Rivera",
              skills,
              location,
              availableDate: "2026-03-15",
              rating: 4.8,
              hourlyRate: 95,
            },
            {
              id: uuidv4(),
              name: "Jordan Chen",
              skills,
              location,
              availableDate: "2026-03-01",
              rating: 4.6,
              hourlyRate: 110,
            },
            {
              id: uuidv4(),
              name: "Priya Patel",
              skills,
              location,
              availableDate: "2026-04-01",
              rating: 4.9,
              hourlyRate: 125,
            },
          ],
          totalMatches: 3,
        },
        durationMs: 0,
      };
    });

    this.registerTool("consultant.shortlist", async (input) => {
      const consultantIds = (input["consultantIds"] as string[]) ?? [];
      const jobId = (input["jobId"] as string) ?? uuidv4();
      return {
        success: true,
        output: {
          shortlistId: uuidv4(),
          jobId,
          consultantIds,
          createdAt: new Date().toISOString(),
          status: "active",
        },
        durationMs: 0,
      };
    });

    this.registerTool("consultant.read", async (input) => {
      const consultantId = (input["consultantId"] as string) ?? uuidv4();
      return {
        success: true,
        output: {
          id: consultantId,
          name: "Alex Rivera",
          email: "alex.rivera@example.com",
          skills: ["TypeScript", "React", "Node.js"],
          experience: 7,
          location: "Austin, TX",
          rating: 4.8,
          hourlyRate: 95,
          availableDate: "2026-03-15",
          submissionCount: 12,
          placementCount: 8,
        },
        durationMs: 0,
      };
    });

    // ── Job tools ──────────────────────────────────────────────────────
    this.registerTool("job.create", async (input) => {
      return {
        success: true,
        output: {
          jobId: uuidv4(),
          title: (input["title"] as string) ?? "Untitled Position",
          client: (input["client"] as string) ?? "Unknown Client",
          status: "draft",
          skills: (input["skills"] as string[]) ?? [],
          rate: input["rate"] ?? null,
          closureLikelihood: 0.72,
          createdAt: new Date().toISOString(),
        },
        durationMs: 0,
      };
    });

    this.registerTool("job.update", async (input) => {
      const jobId = (input["jobId"] as string) ?? uuidv4();
      return {
        success: true,
        output: {
          jobId,
          updated: true,
          fields: Object.keys(input).filter((k) => k !== "jobId"),
          updatedAt: new Date().toISOString(),
        },
        durationMs: 0,
      };
    });

    this.registerTool("job.query", async (input) => {
      return {
        success: true,
        output: {
          jobs: [
            {
              jobId: uuidv4(),
              title: "Senior React Developer",
              client: "Acme Corp",
              status: "open",
              skills: ["React", "TypeScript"],
              createdAt: "2026-02-01T00:00:00Z",
            },
          ],
          total: 1,
          filters: input,
        },
        durationMs: 0,
      };
    });

    // ── Submission tools ───────────────────────────────────────────────
    this.registerTool("submission.create", async (input) => {
      return {
        success: true,
        output: {
          submissionId: uuidv4(),
          jobId: (input["jobId"] as string) ?? uuidv4(),
          consultantId: (input["consultantId"] as string) ?? uuidv4(),
          vendorId: (input["vendorId"] as string) ?? uuidv4(),
          status: "pending_review",
          consentVerified: true,
          createdAt: new Date().toISOString(),
        },
        durationMs: 0,
      };
    });

    this.registerTool("submission.check_duplicate", async (input) => {
      const jobId = (input["jobId"] as string) ?? "";
      const consultantId = (input["consultantId"] as string) ?? "";
      return {
        success: true,
        output: {
          isDuplicate: false,
          jobId,
          consultantId,
          existingSubmissions: [],
        },
        durationMs: 0,
      };
    });

    // ── Vendor tools ───────────────────────────────────────────────────
    this.registerTool("vendor.create", async (input) => {
      return {
        success: true,
        output: {
          vendorId: uuidv4(),
          name: (input["name"] as string) ?? "New Vendor",
          status: "pending_onboarding",
          riskLevel: "medium",
          createdAt: new Date().toISOString(),
        },
        durationMs: 0,
      };
    });

    this.registerTool("vendor.update", async (input) => {
      const vendorId = (input["vendorId"] as string) ?? uuidv4();
      return {
        success: true,
        output: {
          vendorId,
          updated: true,
          fields: Object.keys(input).filter((k) => k !== "vendorId"),
          updatedAt: new Date().toISOString(),
        },
        durationMs: 0,
      };
    });

    this.registerTool("vendor.query", async (input) => {
      return {
        success: true,
        output: {
          vendors: [
            {
              vendorId: uuidv4(),
              name: "TechStaff Solutions",
              status: "active",
              trustScore: 0.85,
              consultantCount: 42,
            },
          ],
          total: 1,
          filters: input,
        },
        durationMs: 0,
      };
    });

    // ── Consent tools ──────────────────────────────────────────────────
    this.registerTool("consent.check", async (input) => {
      const consultantId = (input["consultantId"] as string) ?? "";
      const jobId = (input["jobId"] as string) ?? "";
      return {
        success: true,
        output: {
          consultantId,
          jobId,
          hasConsent: true,
          consentType: "blanket",
          grantedAt: "2026-01-15T00:00:00Z",
          expiresAt: "2027-01-15T00:00:00Z",
        },
        durationMs: 0,
      };
    });

    this.registerTool("consent.request", async (input) => {
      const consultantId = (input["consultantId"] as string) ?? "";
      const jobId = (input["jobId"] as string) ?? "";
      return {
        success: true,
        output: {
          requestId: uuidv4(),
          consultantId,
          jobId,
          status: "pending",
          sentVia: "email",
          sentAt: new Date().toISOString(),
        },
        durationMs: 0,
      };
    });

    // ── Email tools ────────────────────────────────────────────────────
    this.registerTool("email.send", async (input) => {
      return {
        success: true,
        output: {
          messageId: uuidv4(),
          to: (input["to"] as string) ?? "unknown@example.com",
          subject: (input["subject"] as string) ?? "No Subject",
          status: "sent",
          sentAt: new Date().toISOString(),
        },
        durationMs: 0,
      };
    });

    this.registerTool("email.draft", async (input) => {
      return {
        success: true,
        output: {
          draftId: uuidv4(),
          to: (input["to"] as string) ?? "unknown@example.com",
          subject: (input["subject"] as string) ?? "No Subject",
          body: (input["body"] as string) ?? "",
          status: "draft",
          createdAt: new Date().toISOString(),
        },
        durationMs: 0,
      };
    });

    // ── Trust tools ────────────────────────────────────────────────────
    this.registerTool("trust.compute", async (input) => {
      const entityId = (input["entityId"] as string) ?? uuidv4();
      const entityType = (input["entityType"] as string) ?? "vendor";
      return {
        success: true,
        output: {
          entityId,
          entityType,
          trustScore: 0.82,
          components: {
            submissionAccuracy: 0.9,
            responseTime: 0.75,
            complianceRate: 0.88,
            historicalPerformance: 0.78,
          },
          computedAt: new Date().toISOString(),
        },
        durationMs: 0,
      };
    });

    this.registerTool("trust.read", async (input) => {
      const entityId = (input["entityId"] as string) ?? uuidv4();
      return {
        success: true,
        output: {
          entityId,
          entityType: (input["entityType"] as string) ?? "vendor",
          currentScore: 0.82,
          trend: "stable",
          history: [
            { score: 0.80, date: "2026-01-01" },
            { score: 0.81, date: "2026-01-15" },
            { score: 0.82, date: "2026-02-01" },
          ],
          lastUpdated: "2026-02-01T00:00:00Z",
        },
        durationMs: 0,
      };
    });

    // ── Compliance tools ───────────────────────────────────────────────
    this.registerTool("compliance.check", async (input) => {
      const entityId = (input["entityId"] as string) ?? uuidv4();
      const entityType = (input["entityType"] as string) ?? "vendor";
      return {
        success: true,
        output: {
          entityId,
          entityType,
          compliant: true,
          checks: [
            { name: "w9_on_file", passed: true },
            { name: "insurance_current", passed: true },
            { name: "nda_signed", passed: true },
            { name: "background_check", passed: true },
          ],
          checkedAt: new Date().toISOString(),
        },
        durationMs: 0,
      };
    });

    this.registerTool("compliance.block", async (input) => {
      const entityId = (input["entityId"] as string) ?? uuidv4();
      const reason = (input["reason"] as string) ?? "Compliance requirements not met";
      return {
        success: true,
        output: {
          entityId,
          blocked: true,
          reason,
          blockedAt: new Date().toISOString(),
          requiredActions: [
            "Upload missing documents",
            "Complete compliance review",
          ],
        },
        durationMs: 0,
      };
    });

    // ── Document tools ─────────────────────────────────────────────────
    this.registerTool("document.request", async (input) => {
      const entityId = (input["entityId"] as string) ?? uuidv4();
      const documentType = (input["documentType"] as string) ?? "general";
      return {
        success: true,
        output: {
          requestId: uuidv4(),
          entityId,
          documentType,
          status: "requested",
          requestedAt: new Date().toISOString(),
          deadline: new Date(Date.now() + 7 * 86_400_000).toISOString(),
        },
        durationMs: 0,
      };
    });

    this.registerTool("document.verify", async (input) => {
      const documentId = (input["documentId"] as string) ?? uuidv4();
      return {
        success: true,
        output: {
          documentId,
          verified: true,
          documentType: (input["documentType"] as string) ?? "general",
          verifiedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 365 * 86_400_000).toISOString(),
        },
        durationMs: 0,
      };
    });
  }
}
