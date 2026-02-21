import { BaseAgent } from "../agent.js";
import type { AgentContext, AgentResult } from "../types.js";

/**
 * SubmissionAgent — verifies consent, checks for duplicates, and creates
 * submissions linking consultants to job openings.
 */
export class SubmissionAgent extends BaseAgent {
  async execute(context: AgentContext): Promise<AgentResult> {
    this.resetCallLog();

    const jobId = (context.input["jobId"] as string) ?? "";
    const consultantId = (context.input["consultantId"] as string) ?? "";
    const vendorId = (context.input["vendorId"] as string) ?? "";

    if (!jobId || !consultantId) {
      return this.buildResult(false, {
        error: "Both jobId and consultantId are required",
      });
    }

    // Step 1: Check consultant consent
    const consentResult = await this.callTool(
      "consent.check",
      { consultantId, jobId },
      `Checking consent for consultant ${consultantId} on job ${jobId}`,
      context.workflowId
    );

    if (!consentResult.success) {
      return this.buildResult(false, {
        error: "Consent check failed",
        details: consentResult.output,
      });
    }

    const hasConsent = consentResult.output["hasConsent"] as boolean;

    if (!hasConsent) {
      const requestResult = await this.callTool(
        "consent.request",
        { consultantId, jobId },
        `Requesting consent from consultant ${consultantId} for job ${jobId}`,
        context.workflowId
      );

      return this.buildResult(false, {
        status: "awaiting_consent",
        consentRequestId: requestResult.output["requestId"],
        message: `Consent not yet granted. Request sent via ${requestResult.output["sentVia"]}`,
      });
    }

    // Step 2: Check for duplicate submissions
    const dupCheckResult = await this.callTool(
      "submission.check_duplicate",
      { jobId, consultantId },
      `Checking for duplicate submission of consultant ${consultantId} on job ${jobId}`,
      context.workflowId
    );

    if (!dupCheckResult.success) {
      return this.buildResult(false, {
        error: "Duplicate check failed",
        details: dupCheckResult.output,
      });
    }

    const isDuplicate = dupCheckResult.output["isDuplicate"] as boolean;

    if (isDuplicate) {
      const existing = dupCheckResult.output["existingSubmissions"];
      this.escalate(
        `Duplicate submission detected for consultant ${consultantId} on job ${jobId}`,
        { jobId, consultantId, existingSubmissions: existing },
        context.workflowId
      );
      return this.buildResult(false, {
        error: "Duplicate submission detected",
        existingSubmissions: existing,
      }, {
        reason: "Duplicate submission requires human review",
        context: { jobId, consultantId, existingSubmissions: existing },
      });
    }

    // Step 3: Create the submission
    const submissionResult = await this.callTool(
      "submission.create",
      { jobId, consultantId, vendorId },
      `Creating submission for consultant ${consultantId} on job ${jobId}`,
      context.workflowId
    );

    if (!submissionResult.success) {
      return this.buildResult(false, {
        error: "Submission creation failed",
        details: submissionResult.output,
      });
    }

    return this.buildResult(true, {
      submissionId: submissionResult.output["submissionId"],
      jobId,
      consultantId,
      vendorId,
      consentVerified: true,
      duplicateChecked: true,
      status: submissionResult.output["status"],
    });
  }
}
