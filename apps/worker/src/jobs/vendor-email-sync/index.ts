/**
 * Microsoft Graph email sync handler.
 * Uses OAuth2 client credentials to sync emails from a configured mailbox
 * and create VendorReq records.
 */

import type { PrismaClient } from "@prisma/client";
import { parseVendorEmail, type ParsedVendorReq } from "./email-parser";

const GRAPH_TENANT_ID = process.env.GRAPH_TENANT_ID;
const GRAPH_CLIENT_ID = process.env.GRAPH_CLIENT_ID;
const GRAPH_CLIENT_SECRET = process.env.GRAPH_CLIENT_SECRET;
const GRAPH_MAILBOX = process.env.GRAPH_MAILBOX;

const FOLDER = "Inbox";

function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#\d+;/g, "")
    .trim();
}

function extractBodyText(msg: GraphMessage): string {
  const body = msg.body;
  if (!body) return "";
  if (body.contentType === "text") return body.content ?? "";
  if (body.contentType === "html" && body.content) {
    return stripHtml(body.content);
  }
  return body.content ?? "";
}

interface GraphMessage {
  id: string;
  subject?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  receivedDateTime?: string;
  body?: { contentType?: string; content?: string };
}

interface GraphDeltaResponse {
  value?: GraphMessage[];
  "@odata.nextLink"?: string;
  "@odata.deltaLink"?: string;
}

interface GraphListResponse {
  value?: GraphMessage[];
  "@odata.nextLink"?: string;
}

export async function handleVendorEmailSync(
  prisma: PrismaClient,
  _data: Record<string, unknown>
): Promise<void> {
  if (!GRAPH_TENANT_ID || !GRAPH_CLIENT_ID || !GRAPH_CLIENT_SECRET || !GRAPH_MAILBOX) {
    console.warn(
      "[VendorEmailSync] Not configured. Set GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_MAILBOX."
    );
    return;
  }

  const tenantId = (_data.tenantId as string) ?? (await prisma.tenant.findFirst({ select: { id: true } }))?.id;
  if (!tenantId) {
    console.warn("[VendorEmailSync] No tenantId in job data and no tenants in database.");
    return;
  }

  let token: string;
  try {
    token = await fetchOAuthToken();
  } catch (err) {
    console.error("[VendorEmailSync] Token fetch failed:", err);
    return;
  }

  let syncState = await prisma.emailSyncState.findUnique({
    where: {
      tenantId_mailbox_folder: { tenantId, mailbox: GRAPH_MAILBOX, folder: FOLDER },
    },
  });

  if (!syncState) {
    syncState = await prisma.emailSyncState.create({
      data: {
        tenantId,
        mailbox: GRAPH_MAILBOX,
        folder: FOLDER,
      },
    });
  }

  let nextUrl: string | null = null;
  let deltaLink: string | null = null;
  let messagesTotal = 0;
  let vendorReqsCreated = 0;

  if (syncState.deltaToken) {
    // deltaToken stores the full deltaLink URL from Microsoft
    nextUrl = syncState.deltaToken;
  } else {
    const d = new Date();
    d.setHours(d.getHours() - 24);
    const filter = `receivedDateTime ge ${d.toISOString()}`;
    nextUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(GRAPH_MAILBOX)}/mailFolders/inbox/messages?$filter=${encodeURIComponent(filter)}&$top=50&$orderby=receivedDateTime desc`;
  }

  while (nextUrl) {
    const res = await fetch(nextUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401) {
      console.error("[VendorEmailSync] Token expired or invalid.");
      return;
    }
    if (res.status === 429) {
      console.error("[VendorEmailSync] Rate limited.");
      return;
    }
    if (!res.ok) {
      console.error("[VendorEmailSync] Graph API error:", res.status, await res.text());
      return;
    }

    const data = (await res.json()) as GraphDeltaResponse | GraphListResponse;
    const messages = data.value ?? [];
    messagesTotal += messages.length;

    if ("@odata.deltaLink" in data && typeof data["@odata.deltaLink"] === "string") {
      deltaLink = data["@odata.deltaLink"];
    }
    nextUrl = ("@odata.nextLink" in data ? data["@odata.nextLink"] : null) ?? null;

    for (const msg of messages) {
      // Skip deleted items from delta response
      if ((msg as { "@removed"?: unknown })["@removed"]) continue;
      try {
        const created = await processMessage(prisma, tenantId, msg);
        if (created) vendorReqsCreated++;
      } catch (err) {
        console.error("[VendorEmailSync] Error processing message", msg.id, err);
      }
    }
  }

  await prisma.emailSyncState.update({
    where: { id: syncState.id },
    data: {
      deltaToken: deltaLink ?? syncState.deltaToken,
      lastSyncAt: new Date(),
      messagesTotal: syncState.messagesTotal + messagesTotal,
      messagesNew: syncState.messagesNew + vendorReqsCreated,
    },
  });

  console.log(
    `[VendorEmailSync] Synced ${messagesTotal} new emails, created ${vendorReqsCreated} vendor reqs`
  );
}

async function fetchOAuthToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: GRAPH_CLIENT_ID!,
    client_secret: GRAPH_CLIENT_SECRET!,
    scope: "https://graph.microsoft.com/.default",
  });

  const res = await fetch(
    `https://login.microsoftonline.com/${GRAPH_TENANT_ID}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }
  );

  if (!res.ok) {
    throw new Error(`OAuth token failed: ${res.status} ${await res.text()}`);
  }

  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) {
    throw new Error("No access_token in OAuth response");
  }
  return json.access_token;
}

async function processMessage(
  prisma: PrismaClient,
  tenantId: string,
  msg: GraphMessage
): Promise<boolean> {
  const messageId = msg.id;
  const subject = msg.subject ?? "";
  const fromEmail = msg.from?.emailAddress?.address ?? "";
  const fromName = msg.from?.emailAddress?.name ?? null;
  const receivedAt = msg.receivedDateTime ? new Date(msg.receivedDateTime) : new Date();
  const bodyText = extractBodyText(msg);

  const existing = await prisma.vendorReq.findFirst({
    where: { tenantId, messageId },
  });
  if (existing) return false;

  const parsed = parseVendorEmail(subject, bodyText, fromEmail, fromName);

  const vendor = await matchVendorByDomain(prisma, tenantId, fromEmail);

  await prisma.vendorReq.create({
    data: buildVendorReqData(tenantId, messageId, msg, fromEmail, fromName, receivedAt, parsed, vendor),
  });

  return true;
}

async function matchVendorByDomain(
  prisma: PrismaClient,
  tenantId: string,
  fromEmail: string
): Promise<{ id: string } | null> {
  const domain = fromEmail.includes("@") ? fromEmail.split("@")[1]?.toLowerCase() : null;
  if (!domain) return null;

  const vendor = await prisma.vendor.findFirst({
    where: {
      tenantId,
      OR: [
        { domain: { equals: domain, mode: "insensitive" } },
        {
          contactEmail: {
            endsWith: `@${domain}`,
            mode: "insensitive",
          },
        },
      ],
    },
    select: { id: true },
  });
  return vendor;
}

function buildVendorReqData(
  tenantId: string,
  messageId: string,
  msg: GraphMessage,
  fromEmail: string,
  fromName: string | null,
  receivedAt: Date,
  parsed: ParsedVendorReq,
  vendor: { id: string } | null
) {
  return {
    tenantId,
    vendorId: vendor?.id ?? null,
    messageId,
    threadId: (msg as { conversationId?: string }).conversationId ?? null,
    fromEmail,
    fromName,
    subject: msg.subject ?? "",
    receivedAt,
    title: parsed.title,
    description: parsed.description,
    location: parsed.location,
    locationType: parsed.locationType,
    employmentType: parsed.employmentType,
    rateText: parsed.rateText,
    hourlyRateMin: parsed.hourlyRateMin,
    hourlyRateMax: parsed.hourlyRateMax,
    duration: parsed.duration,
    clientHint: parsed.clientHint,
    skills: parsed.skills,
    negativeSignals: parsed.negativeSignals,
    matchedByDomain: !!vendor,
    rawBody: parsed.description,
  };
}
