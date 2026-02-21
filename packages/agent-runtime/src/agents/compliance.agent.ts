import { BaseAgent } from "../agent.js";
import type { AgentContext, AgentResult } from "../types.js";

/**
 * ComplianceAgent — checks required documents and compliance status,
 * blocks onboarding if requirements are incomplete.
 */
export class ComplianceAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    this.resetCallLog();

    const entityId = (context.input["entityId"] as string) ?? "";
    const entityType = (context.input["entityType"] as string) ?? "vendor";
    const documentIds = (context.input["documentIds"] as string[]) ?? [];

    if (!entityId) {
      return this.buildResult(false, {
        error: "entityId is required for compliance check",
      });
    }

    // Step 1: Run compliance checks against entity
    const complianceResult = await this.callTool(
      "compliance.check",
      { entityId, entityType },
      `Running compliance checks for ${entityType} ${entityId}`,
      context.workflowId
    );

    if (!complianceResult.success) {
      return this.buildResult(false, {
        error: "Compliance check failed",
        details: complianceResult.output,
      });
    }

    const checks = (complianceResult.output["checks"] as Array<{ name: string; passed: boolean }>) ?? [];
    const failedChecks = checks.filter((c) => !c.passed);

    // Step 2: Verify any provided documents
    const verificationResults: Array<Record<string, unknown>> = [];
    for (const docId of documentIds) {
      const verifyResult = await this.callTool(
        "document.verify",
        { documentId: docId, entityId, entityType },
        `Verifying document ${docId} for ${entityType} ${entityId}`,
        context.workflowId
      );

      verificationResults.push({
        documentId: docId,
        verified: verifyResult.success && (verifyResult.output["verified"] as boolean),
        details: verifyResult.output,
      });
    }

    const unverifiedDocs = verificationResults.filter((v) => !v["verified"]);

    // Step 3: Block if non-compliant
    const isCompliant = failedChecks.length === 0 && unverifiedDocs.length === 0;

    if (!isCompliant) {
      const reasons: string[] = [];

      if (failedChecks.length > 0) {
        reasons.push(
          `Failed compliance checks: [${failedChecks.map((c) => c.name).join(", ")}]`
        );
      }
      if (unverifiedDocs.length > 0) {
        reasons.push(
          `Unverified documents: [${unverifiedDocs.map((d) => d["documentId"]).join(", ")}]`
        );
      }

      const blockReason = reasons.join("; ");

      const blockResult = await this.callTool(
        "compliance.block",
        { entityId, entityType, reason: blockReason },
        `Blocking ${entityType} ${entityId} due to compliance failures`,
        context.workflowId
      );

      this.escalate(
        `Compliance block applied to ${entityType} ${entityId}`,
        {
          entityId,
          entityType,
          failedChecks,
          unverifiedDocs,
          blockResult: blockResult.output,
        },
        context.workflowId
      );

      return this.buildResult(false, {
        entityId,
        entityType,
        compliant: false,
        failedChecks,
        unverifiedDocs,
        blocked: true,
        requiredActions: blockResult.output["requiredActions"],
      }, {
        reason: blockReason,
        context: { entityId, entityType, failedChecks, unverifiedDocs },
      });
    }

    return this.buildResult(true, {
      entityId,
      entityType,
      compliant: true,
      checksRun: checks.length,
      documentsVerified: verificationResults.length,
      allChecksPassed: true,
    });
  }
}
