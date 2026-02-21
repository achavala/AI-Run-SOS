import { BaseAgent } from "../agent.js";
import type { AgentContext, AgentResult } from "../types.js";

/**
 * VendorOnboardingAgent — initiates vendor data collection, requests required
 * documents, flags high-risk terms, and sends onboarding communications.
 */
export class VendorOnboardingAgent extends BaseAgent {
  private static readonly REQUIRED_DOCUMENTS = [
    "w9",
    "certificate_of_insurance",
    "nda",
    "master_service_agreement",
  ];

  private static readonly HIGH_RISK_TERMS = [
    "unlimited liability",
    "sole remedy",
    "auto-renewal",
    "non-compete",
    "exclusive",
  ];

  async execute(context: AgentContext): Promise<AgentResult> {
    this.resetCallLog();

    const vendorName = (context.input["vendorName"] as string) ?? "";
    const contactEmail = (context.input["contactEmail"] as string) ?? "";
    const contractTerms = (context.input["contractTerms"] as string) ?? "";

    if (!vendorName || !contactEmail) {
      return this.buildResult(false, {
        error: "vendorName and contactEmail are required",
      });
    }

    // Step 1: Create vendor record
    const createResult = await this.callTool(
      "vendor.create",
      { name: vendorName, contactEmail, status: "pending_onboarding" },
      `Creating vendor record for ${vendorName}`,
      context.workflowId
    );

    if (!createResult.success) {
      return this.buildResult(false, {
        error: "Failed to create vendor record",
        details: createResult.output,
      });
    }

    const vendorId = createResult.output["vendorId"] as string;

    // Step 2: Analyze contract terms for risk
    const riskFlags = this.analyzeContractRisk(contractTerms);

    if (riskFlags.length > 0) {
      await this.callTool(
        "vendor.update",
        { vendorId, riskLevel: "high", riskFlags },
        `Flagging vendor ${vendorId} as high-risk due to: [${riskFlags.join(", ")}]`,
        context.workflowId
      );

      this.escalate(
        `High-risk contract terms detected for vendor "${vendorName}"`,
        { vendorId, riskFlags, contractTerms },
        context.workflowId
      );
    }

    // Step 3: Request required documents
    const documentRequests: Array<Record<string, unknown>> = [];
    for (const docType of VendorOnboardingAgent.REQUIRED_DOCUMENTS) {
      const docResult = await this.callTool(
        "document.request",
        { entityId: vendorId, documentType: docType },
        `Requesting ${docType} from vendor ${vendorName}`,
        context.workflowId
      );

      if (docResult.success) {
        documentRequests.push({
          documentType: docType,
          requestId: docResult.output["requestId"],
          deadline: docResult.output["deadline"],
        });
      }
    }

    // Step 4: Send onboarding welcome email
    const emailResult = await this.callTool(
      "email.send",
      {
        to: contactEmail,
        subject: `Welcome to the platform — onboarding for ${vendorName}`,
        body: this.buildWelcomeEmail(vendorName, documentRequests),
      },
      `Sending onboarding welcome email to ${contactEmail}`,
      context.workflowId
    );

    return this.buildResult(true, {
      vendorId,
      vendorName,
      status: riskFlags.length > 0 ? "pending_risk_review" : "pending_onboarding",
      riskFlags,
      documentRequests,
      emailSent: emailResult.success,
      emailMessageId: emailResult.output["messageId"],
    }, riskFlags.length > 0 ? {
      reason: "High-risk contract terms require human review",
      context: { vendorId, riskFlags },
    } : undefined);
  }

  private analyzeContractRisk(contractTerms: string): string[] {
    if (!contractTerms) return [];

    const lower = contractTerms.toLowerCase();
    return VendorOnboardingAgent.HIGH_RISK_TERMS.filter((term) =>
      lower.includes(term)
    );
  }

  private buildWelcomeEmail(
    vendorName: string,
    docRequests: Array<Record<string, unknown>>
  ): string {
    const docList = docRequests
      .map(
        (d) =>
          `- ${d["documentType"]} (due by ${d["deadline"]})`
      )
      .join("\n");

    return [
      `Hello ${vendorName} team,`,
      "",
      "Welcome to our staffing platform. To complete your onboarding, please provide the following documents:",
      "",
      docList,
      "",
      "Please upload these documents through the vendor portal at your earliest convenience.",
      "",
      "Best regards,",
      "The Staffing Operations Team",
    ].join("\n");
  }
}
