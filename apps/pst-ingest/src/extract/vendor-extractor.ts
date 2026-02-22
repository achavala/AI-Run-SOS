import prisma from '../db';

const BATCH_SIZE = 500;

const FREE_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'aol.com',
  'icloud.com',
  'mail.com',
  'protonmail.com',
  'zoho.com',
  'ymail.com',
  'live.com',
  'msn.com',
  'comcast.net',
  'att.net',
  'verizon.net',
  'cox.net',
  'sbcglobal.net',
  'earthlink.net',
  'charter.net',
  'emonics.com', // the user's own domain — not a vendor
]);

const PHONE_REGEX = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g;
const LINKEDIN_REGEX = /linkedin\.com\/in\/([a-zA-Z0-9_-]+)/g;

function extractDomain(email: string): string | null {
  const at = email.indexOf('@');
  if (at === -1) return null;
  return email.slice(at + 1).toLowerCase();
}

function deriveCompanyName(domain: string): string {
  // Remove common TLDs
  const base = domain.replace(/\.(com|net|io|org|co|biz|info|us|uk)$/i, '');
  // Replace hyphens/underscores with spaces
  const words = base.replace(/[-_]/g, ' ').split(/\s+/);
  // Capitalize each word
  return words
    .map((w) => (w.length > 0 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ')
    .trim() || base;
}

function parseSignature(bodyText: string | null): { phone?: string; linkedin?: string } {
  if (!bodyText) return {};
  const lines = bodyText.split(/\r?\n/);
  const lastLines = lines.slice(-20).join('\n');
  const result: { phone?: string; linkedin?: string } = {};

  const phoneMatch = lastLines.match(PHONE_REGEX);
  if (phoneMatch) result.phone = phoneMatch[0].trim();

  const linkedinMatch = lastLines.match(LINKEDIN_REGEX);
  if (linkedinMatch) {
    const slug = linkedinMatch[0].split('/in/')[1]?.split(/[?\s]/)[0];
    if (slug) result.linkedin = `https://linkedin.com/in/${slug}`;
  }

  return result;
}

export async function extractVendors(): Promise<{ companies: number; contacts: number }> {
  const companiesSeen = new Set<string>();
  const contactsSeen = new Set<string>();
  let totalProcessed = 0;

  while (true) {
    const emails = await prisma.rawEmailMessage.findMany({
      where: { processed: false, fromEmail: { not: null } },
      take: BATCH_SIZE,
      orderBy: { createdAt: 'asc' },
    });

    if (emails.length === 0) break;

    for (const rawEmail of emails) {
      try {
        const fromEmail = rawEmail.fromEmail?.trim();
        if (!fromEmail) continue;

        const domain = extractDomain(fromEmail);
        if (!domain || FREE_DOMAINS.has(domain)) continue;

        const sentAt = rawEmail.sentAt ?? new Date();
        const companyName = deriveCompanyName(domain);

        const company = await prisma.extractedVendorCompany.upsert({
          where: { domain },
          create: {
            domain,
            name: companyName,
            emailCount: 1,
            firstSeenAt: sentAt,
            lastSeenAt: sentAt,
          },
          update: {
            name: companyName,
            emailCount: { increment: 1 },
            lastSeenAt: sentAt,
          },
        });

        companiesSeen.add(domain);

        const contact = await prisma.extractedVendorContact.upsert({
          where: { email: fromEmail },
          create: {
            email: fromEmail,
            name: rawEmail.fromName ?? null,
            vendorCompanyId: company.id,
            emailCount: 1,
            firstSeenAt: sentAt,
            lastSeenAt: sentAt,
          },
          update: {
            name: rawEmail.fromName ?? undefined,
            vendorCompanyId: company.id,
            emailCount: { increment: 1 },
            lastSeenAt: sentAt,
          },
        });

        contactsSeen.add(fromEmail);

        const sig = parseSignature(rawEmail.bodyText);
        const updates: { phone?: string; linkedIn?: string } = {};

        if (sig.phone && !contact.phone) {
          updates.phone = sig.phone;
        }
        if (sig.linkedin && !contact.linkedIn) {
          updates.linkedIn = sig.linkedin;
        }

        if (Object.keys(updates).length > 0) {
          await prisma.extractedVendorContact.update({
            where: { id: contact.id },
            data: updates,
          });

          if (updates.phone) {
            await prisma.extractionFact.create({
              data: {
                entityType: 'vendor_contact',
                entityId: contact.id,
                field: 'phone',
                value: updates.phone,
                confidence: 0.7,
                sourceEmailId: rawEmail.id,
              },
            });
          }
          if (updates.linkedIn) {
            await prisma.extractionFact.create({
              data: {
                entityType: 'vendor_contact',
                entityId: contact.id,
                field: 'linkedin',
                value: updates.linkedIn,
                confidence: 0.7,
                sourceEmailId: rawEmail.id,
              },
            });
          }
        }
      } catch (err) {
        console.error(`[vendor-extractor] Error processing email ${rawEmail.id}:`, err);
      }
    }

    await prisma.rawEmailMessage.updateMany({
      where: { id: { in: emails.map((e) => e.id) } },
      data: { processed: true },
    });

    totalProcessed += emails.length;
    console.log(`[vendor-extractor] Processed ${totalProcessed} emails (companies: ${companiesSeen.size}, contacts: ${contactsSeen.size})`);
  }

  console.log(`[vendor-extractor] Done. Total companies: ${companiesSeen.size}, contacts: ${contactsSeen.size}`);
  return { companies: companiesSeen.size, contacts: contactsSeen.size };
}
