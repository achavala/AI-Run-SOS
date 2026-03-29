import type { PrismaClient } from "@prisma/client";
import axios from "axios";

const OPENAI_MODEL = process.env.LLM_MODEL || "gpt-4o-mini";

interface ExtractionResult {
  jobTitle: string | null;
  location: string | null;
  rate: string | null;
  skills: string[];
  employmentType: string | null;
  vendorName: string | null;
  contactName: string | null;
  contactEmail: string | null;
  responseType: string | null;
  confidence: number;
}

const EXTRACTION_PROMPT = `You are an expert at extracting structured data from staffing/recruiting emails.

Extract the following fields from the email below. Return a JSON object with these fields:
- jobTitle: The job/role title (string or null)
- location: Job location (string or null)
- rate: Pay rate text as written (string or null)
- skills: Array of technical skills mentioned (string[])
- employmentType: One of "C2C", "W2", "FTE", "Contract", "Contract-to-Hire", or null
- vendorName: The company/vendor name (string or null)
- contactName: Recruiter/contact person name (string or null)
- contactEmail: Contact email if present (string or null)
- responseType: If this is a response to a submission, classify as one of: "INTERVIEW_REQUEST", "NEED_RTR", "RATE_TOO_HIGH", "NOT_A_MATCH", "CLIENT_SUBMITTED", "NO_THIRD_PARTY", "POSITION_CLOSED", "ACKNOWLEDGED", or null if not a response
- confidence: Your confidence in the extraction from 0.0 to 1.0

Return ONLY the JSON object, no markdown formatting.`;

export async function handleLlmExtraction(
  prisma: PrismaClient,
  _data: Record<string, unknown>
): Promise<void> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.log("[llm-extraction] OPENAI_API_KEY not set, skipping");
    return;
  }

  // Find emails that were processed but have low-confidence or ambiguous extractions
  const ambiguousEmails = await prisma.$queryRaw<any[]>`
    SELECT rem.id, rem.subject, rem."fromEmail", rem."bodyText", rem."sentAt"
    FROM "RawEmailMessage" rem
    WHERE rem.processed = true
      AND rem."sentAt" >= NOW() - interval '48 hours'
      AND rem."bodyText" IS NOT NULL AND length(rem."bodyText") > 50
      AND NOT EXISTS (
        SELECT 1 FROM "VendorReqSignal" vrs
        WHERE vrs."emailId" = rem.id::text
          AND vrs."actionabilityScore" >= 50
      )
      AND rem.category IS NULL OR rem.category = 'general'
    ORDER BY rem."sentAt" DESC
    LIMIT 30
  `;

  if (ambiguousEmails.length === 0) {
    console.log("[llm-extraction] No ambiguous emails to process");
    return;
  }

  console.log(`[llm-extraction] Processing ${ambiguousEmails.length} ambiguous emails with LLM`);

  let enriched = 0;
  let failed = 0;

  for (const email of ambiguousEmails) {
    try {
      const emailText = [
        `Subject: ${email.subject || "(no subject)"}`,
        `From: ${email.fromEmail || "unknown"}`,
        "",
        (email.bodyText || "").slice(0, 4000),
      ].join("\n");

      const result = await callLlm(apiKey, emailText);
      if (!result) {
        failed++;
        continue;
      }

      // If a job was extracted with decent confidence, create a VendorReqSignal
      if (result.jobTitle && result.confidence >= 0.6) {
        const vendorDomain = email.fromEmail?.split("@")[1]?.toLowerCase();

        // Find or reference vendor company
        let vendorCompanyId: string | null = null;
        if (vendorDomain) {
          const vc = await prisma.extractedVendorCompany.findFirst({
            where: { domain: vendorDomain },
            select: { id: true },
          });
          vendorCompanyId = vc?.id || null;
        }

        const exists = await prisma.$queryRaw<any[]>`
          SELECT id FROM "VendorReqSignal"
          WHERE "emailId" = ${email.id}::text
          LIMIT 1
        `;

        if (exists.length === 0) {
          await prisma.$executeRaw`
            INSERT INTO "VendorReqSignal" (id, title, location, "rateText", skills, "employmentType",
              "vendorCompanyId", "actionabilityScore", source, "emailId", "createdAt")
            VALUES (
              gen_random_uuid()::text,
              ${result.jobTitle},
              ${result.location},
              ${result.rate},
              ${JSON.stringify(result.skills)}::jsonb,
              ${result.employmentType},
              ${vendorCompanyId},
              ${Math.round(result.confidence * 100)},
              'LLM_EXTRACTION',
              ${email.id}::text,
              NOW()
            )
          `;

          enriched++;
        }
      }

      // Update the email category if detected
      if (result.responseType) {
        await prisma.rawEmailMessage.update({
          where: { id: email.id },
          data: { category: "vendor_reply" },
        });
      } else if (result.jobTitle) {
        await prisma.rawEmailMessage.update({
          where: { id: email.id },
          data: { category: "vendor_req" },
        });
      }

      // Throttle: 200ms between LLM calls
      await new Promise((r) => setTimeout(r, 200));
    } catch (err: any) {
      failed++;
      console.error(`[llm-extraction] Failed for email ${email.id}: ${err.message}`);
    }
  }

  console.log(`[llm-extraction] Complete: ${enriched} enriched, ${failed} failed out of ${ambiguousEmails.length}`);
}

async function callLlm(apiKey: string, emailText: string): Promise<ExtractionResult | null> {
  try {
    const response = await axios.post(
      "https://api.openai.com/v1/chat/completions",
      {
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: EXTRACTION_PROMPT },
          { role: "user", content: emailText },
        ],
        temperature: 0.1,
        max_tokens: 800,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: 30_000,
      }
    );

    const content = response.data?.choices?.[0]?.message?.content;
    if (!content) return null;

    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned) as ExtractionResult;
  } catch (err: any) {
    console.error(`[llm-extraction] LLM call failed: ${err.message}`);
    return null;
  }
}
