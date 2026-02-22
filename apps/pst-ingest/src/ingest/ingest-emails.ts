import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import * as readline from 'readline';
import { simpleParser } from 'mailparser';
import type { ParsedMail } from 'mailparser';
import prisma from '../db';

const PROGRESS_LOG_INTERVAL = 500;
const BODY_TEXT_MAX_BYTES = 500 * 1024;
const BODY_HTML_MAX_BYTES = 200 * 1024;

const STORAGE_ROOT = path.resolve(
  __dirname, '..', '..', '..', '..', 'storage', 'attachments',
);

function extractAddresses(field: any): string[] {
  if (!field) return [];
  if (Array.isArray(field.value))
    return field.value.map((v: any) => v.address).filter(Boolean);
  if (field.text) return [field.text];
  return [];
}

function truncateToBytes(str: string | null | undefined, maxBytes: number): string | null {
  if (str == null) return null;
  const buf = Buffer.from(str, 'utf8');
  if (buf.length <= maxBytes) return str;
  return buf.subarray(0, maxBytes).toString('utf8');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, '_').slice(0, 200) || 'unnamed';
}

/**
 * Find all mbox files recursively in a directory.
 */
function collectMboxFiles(dir: string): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectMboxFiles(fullPath));
    } else if (entry.isFile() && entry.name === 'mbox') {
      const stat = fs.statSync(fullPath);
      if (stat.size > 0) {
        results.push(fullPath);
      }
    }
  }
  return results;
}

/**
 * Split an mbox file into individual email buffers by streaming line-by-line.
 * mbox format: each message starts with a line beginning with "From ".
 */
async function* streamMboxMessages(
  mboxPath: string,
): AsyncGenerator<{ index: number; raw: Buffer }> {
  const stream = fs.createReadStream(mboxPath);
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

  let currentLines: string[] = [];
  let messageIndex = 0;

  for await (const line of rl) {
    if (line.startsWith('From ') && currentLines.length > 0) {
      const raw = Buffer.from(currentLines.join('\n'), 'utf8');
      yield { index: messageIndex++, raw };
      currentLines = [];
    }
    currentLines.push(line);
  }

  if (currentLines.length > 0) {
    const raw = Buffer.from(currentLines.join('\n'), 'utf8');
    yield { index: messageIndex, raw };
  }

  stream.destroy();
}

export async function ingestEmails(
  batchName: string,
  dir: string,
): Promise<{ total: number; inserted: number; skipped: number; errors: number }> {
  const resolvedDir = path.resolve(dir);
  if (!fs.existsSync(resolvedDir)) {
    throw new Error(`Directory does not exist: ${resolvedDir}`);
  }

  if (!fs.existsSync(STORAGE_ROOT)) {
    fs.mkdirSync(STORAGE_ROOT, { recursive: true });
  }

  const mboxFiles = collectMboxFiles(resolvedDir);
  console.log(`[Ingest] Found ${mboxFiles.length} mbox files in ${resolvedDir}`);

  let total = 0;
  let inserted = 0;
  let skipped = 0;
  let errors = 0;

  for (const mboxPath of mboxFiles) {
    const relativeMbox = path.relative(resolvedDir, mboxPath);
    const stat = fs.statSync(mboxPath);
    console.log(`[Ingest] Processing ${relativeMbox} (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);

    for await (const { index, raw } of streamMboxMessages(mboxPath)) {
      total++;

      try {
        const parsed = await simpleParser(raw);

        // Source path = mbox relative path + message index
        const sourcePath = `${relativeMbox}#${index}`;

        // Skip if already ingested
        const existing = await prisma.rawEmailMessage.findFirst({
          where: { sourcePath, pstBatch: batchName },
          select: { id: true },
        });
        if (existing) {
          skipped++;
          if (total % PROGRESS_LOG_INTERVAL === 0) {
            console.log(`[Ingest] ${total} messages processed (${inserted} new, ${skipped} skipped, ${errors} errors)`);
          }
          continue;
        }

        const messageData = buildMessageData(batchName, sourcePath, parsed);
        const attachmentData = processAttachments(parsed);

        await prisma.rawEmailMessage.create({
          data: {
            ...messageData,
            attachments: {
              create: attachmentData,
            },
          },
        });

        inserted++;
      } catch (err) {
        errors++;
        if (errors <= 20) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`[Ingest] Error in ${relativeMbox}#${index}: ${msg.slice(0, 200)}`);
        }
      }

      if (total % PROGRESS_LOG_INTERVAL === 0) {
        console.log(`[Ingest] ${total} messages processed (${inserted} new, ${skipped} skipped, ${errors} errors)`);
      }
    }
  }

  console.log(
    `[Ingest] Complete: ${inserted} inserted, ${skipped} skipped, ${errors} errors out of ${total} messages`,
  );
  return { total, inserted, skipped, errors };
}

function buildMessageData(batchName: string, sourcePath: string, parsed: ParsedMail) {
  const fromAddr = parsed.from?.value?.[0];
  const threadHint =
    parsed.inReplyTo ?? (parsed.subject ? parsed.subject.slice(0, 100) : null) ?? null;

  const bodyText = truncateToBytes(parsed.text ?? null, BODY_TEXT_MAX_BYTES);
  const bodyHtmlRaw = typeof parsed.html === 'string' ? parsed.html : null;
  const bodyHtml =
    bodyHtmlRaw != null && Buffer.byteLength(bodyHtmlRaw, 'utf8') <= BODY_HTML_MAX_BYTES
      ? bodyHtmlRaw
      : null;

  return {
    pstBatch: batchName,
    sourcePath,
    messageId: parsed.messageId ?? null,
    threadHint,
    subject: parsed.subject ?? null,
    fromEmail: fromAddr?.address?.toLowerCase() ?? null,
    fromName: fromAddr?.name ?? null,
    toEmails: extractAddresses(parsed.to),
    ccEmails: extractAddresses(parsed.cc),
    sentAt: parsed.date ?? null,
    bodyText,
    bodyHtml,
  };
}

function processAttachments(parsed: ParsedMail) {
  const result: Array<{
    filename: string | null;
    contentType: string | null;
    sizeBytes: number;
    sha256: string;
    storagePath: string;
  }> = [];
  const attachments = parsed.attachments ?? [];

  for (const att of attachments) {
    const content = att.content;
    if (!content || !Buffer.isBuffer(content)) continue;

    const sha256 = crypto.createHash('sha256').update(content).digest('hex');
    const filename = sanitizeFilename(att.filename ?? 'unnamed');
    const storageFilename = `${sha256}_${filename}`;
    const diskPath = path.join(STORAGE_ROOT, storageFilename);
    const storagePathForDb = `storage/attachments/${storageFilename}`;

    if (!fs.existsSync(diskPath)) {
      fs.writeFileSync(diskPath, content);
    }

    result.push({
      filename: att.filename ?? null,
      contentType: att.contentType ?? null,
      sizeBytes: content.length,
      sha256,
      storagePath: storagePathForDb,
    });
  }

  return result;
}
