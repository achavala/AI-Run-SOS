import type { PrismaClient } from "@prisma/client";
import axios from "axios";

export async function handleRecruiterDigest(
  prisma: PrismaClient,
  _data: Record<string, unknown>
): Promise<void> {
  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  for (const tenant of tenants) {
    await generateAndSendDigest(prisma, tenant.id);
  }
}

async function generateAndSendDigest(prisma: PrismaClient, tenantId: string) {
  const senderEmail = process.env.SUBMISSION_SENDER_EMAIL;
  if (!senderEmail) {
    console.log("[recruiter-digest] SUBMISSION_SENDER_EMAIL not set, skipping");
    return;
  }

  // Get top 10 premium reqs from last 24h
  const topReqs = await prisma.$queryRaw<any[]>`
    SELECT
      vrs.id,
      vrs.title,
      vrs.location,
      vrs."rateText",
      vrs."employmentType",
      vrs."actionabilityScore",
      vc.name as "vendorName",
      COALESCE(v."trustScore", 50) as "vendorTrustScore"
    FROM "VendorReqSignal" vrs
    LEFT JOIN "ExtractedVendorCompany" vc ON vc.id = vrs."vendorCompanyId"
    LEFT JOIN "Vendor" v ON v.domain = vc.domain
    WHERE vrs."createdAt" >= NOW() - interval '24 hours'
      AND vrs.title IS NOT NULL AND length(vrs.title) > 10
      AND COALESCE(vrs."actionabilityScore", 0) >= 50
      AND COALESCE(v."trustScore", 50) >= 40
    ORDER BY COALESCE(vrs."actionabilityScore", 0) DESC, COALESCE(v."trustScore", 50) DESC
    LIMIT 10
  `;

  // Get pipeline summary
  const pipeline = await prisma.submission.groupBy({
    by: ["status"],
    where: { tenantId },
    _count: true,
  });

  const pipelineMap: Record<string, number> = {};
  for (const p of pipeline) {
    pipelineMap[p.status] = p._count;
  }

  // Get today's scoreboard
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const scoreboard = await prisma.dailyScoreboard.findUnique({
    where: { tenantId_date: { tenantId, date: today } },
  });

  // Get recruiters (users with recruitment role)
  const recruiters = await prisma.user.findMany({
    where: { tenantId, role: { in: ["RECRUITMENT", "MANAGEMENT", "SUPERADMIN"] } },
    select: { email: true, firstName: true },
  });

  if (recruiters.length === 0 || topReqs.length === 0) return;

  const appUrl = process.env.APP_BASE_URL || "http://localhost:3000";
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const reqRows = topReqs
    .map(
      (r: any, i: number) =>
        `<tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${i + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;"><b>${r.title}</b></td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${r.location || "Remote"}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${r.rateText || "N/A"}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${r.vendorName || "Unknown"}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;">${Math.round(r.vendorTrustScore)}</td>
      </tr>`
    )
    .join("");

  const htmlBody = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:700px;margin:0 auto;">
      <div style="background:#1a56db;color:white;padding:20px 24px;border-radius:8px 8px 0 0;">
        <h1 style="margin:0;font-size:20px;">AI-RUN-SOS Daily Digest</h1>
        <p style="margin:4px 0 0;opacity:0.9;">${dateStr}</p>
      </div>

      <div style="padding:20px 24px;background:#f9fafb;border:1px solid #e5e7eb;">
        <h2 style="color:#1a56db;margin-top:0;">Pipeline Summary</h2>
        <table style="width:100%;border-collapse:collapse;">
          <tr>
            <td style="padding:6px 12px;background:#dbeafe;border-radius:4px;text-align:center;"><b>${pipelineMap["SUBMITTED"] || 0}</b><br><small>Submitted</small></td>
            <td style="padding:6px 12px;background:#fef3c7;border-radius:4px;text-align:center;"><b>${pipelineMap["INTERVIEWING"] || 0}</b><br><small>Interviewing</small></td>
            <td style="padding:6px 12px;background:#d1fae5;border-radius:4px;text-align:center;"><b>${pipelineMap["OFFERED"] || 0}</b><br><small>Offered</small></td>
            <td style="padding:6px 12px;background:#bbf7d0;border-radius:4px;text-align:center;"><b>${pipelineMap["ACCEPTED"] || 0}</b><br><small>Closed</small></td>
          </tr>
        </table>

        ${
          scoreboard
            ? `<p style="margin-top:12px;color:#6b7280;">
            Today: ${scoreboard.actualSubmissions} submissions, ${scoreboard.actualInterviews} interviews, ${scoreboard.actualClosures} closures
            ${scoreboard.subToInterviewRate ? ` | Sub→Interview: ${(scoreboard.subToInterviewRate * 100).toFixed(1)}%` : ""}
          </p>`
            : ""
        }
      </div>

      <div style="padding:20px 24px;border:1px solid #e5e7eb;border-top:none;">
        <h2 style="color:#1a56db;">Top 10 Premium Requirements (Last 24h)</h2>
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <tr style="background:#f3f4f6;">
            <th style="padding:8px;text-align:left;">#</th>
            <th style="padding:8px;text-align:left;">Title</th>
            <th style="padding:8px;text-align:left;">Location</th>
            <th style="padding:8px;text-align:left;">Rate</th>
            <th style="padding:8px;text-align:left;">Vendor</th>
            <th style="padding:8px;text-align:left;">Trust</th>
          </tr>
          ${reqRows}
        </table>
      </div>

      <div style="padding:16px 24px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;text-align:center;">
        <a href="${appUrl}/dashboard/live-feed" style="display:inline-block;background:#1a56db;color:white;padding:10px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
          Open Live Feed →
        </a>
        <p style="margin:12px 0 0;color:#9ca3af;font-size:12px;">
          Generated by AI-RUN-SOS AutopilotGM | Cloud Resources
        </p>
      </div>
    </div>
  `;

  // Send to each recruiter via Graph API
  const graphTenantId = process.env.GRAPH_TENANT_ID;
  const clientId = process.env.GRAPH_CLIENT_ID;
  const clientSecret = process.env.GRAPH_CLIENT_SECRET;

  if (!graphTenantId || !clientId || !clientSecret) {
    console.log("[recruiter-digest] Graph API credentials not configured, skipping email send");
    return;
  }

  try {
    const tokenRes = await axios.post(
      `https://login.microsoftonline.com/${graphTenantId}/oauth2/v2.0/token`,
      new URLSearchParams({
        client_id: clientId,
        scope: "https://graph.microsoft.com/.default",
        client_secret: clientSecret,
        grant_type: "client_credentials",
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const token = tokenRes.data.access_token;

    for (const recruiter of recruiters) {
      try {
        const message = {
          subject: `Daily Digest: ${topReqs.length} Premium Reqs | ${pipelineMap["SUBMITTED"] || 0} Active Submissions`,
          body: { contentType: "HTML", content: htmlBody },
          toRecipients: [{ emailAddress: { address: recruiter.email } }],
        };

        await axios.post(
          `https://graph.microsoft.com/v1.0/users/${senderEmail}/messages`,
          message,
          { headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" } }
        );

        const drafts = await axios.get(
          `https://graph.microsoft.com/v1.0/users/${senderEmail}/mailFolders/drafts/messages?$top=1&$orderby=createdDateTime desc`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const draftId = drafts.data?.value?.[0]?.id;
        if (draftId) {
          await axios.post(
            `https://graph.microsoft.com/v1.0/users/${senderEmail}/messages/${draftId}/send`,
            null,
            { headers: { Authorization: `Bearer ${token}` } }
          );
        }

        console.log(`[recruiter-digest] Sent to ${recruiter.email}`);
      } catch (err: any) {
        console.error(`[recruiter-digest] Failed to send to ${recruiter.email}: ${err.message}`);
      }
    }
  } catch (err: any) {
    console.error(`[recruiter-digest] Graph API auth failed: ${err.message}`);
  }
}
