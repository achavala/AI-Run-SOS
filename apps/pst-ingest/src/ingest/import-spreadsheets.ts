/**
 * Import consultant data from Excel spreadsheets into ExtractedConsultant.
 * Handles multiple sheet formats found in Data (1).xlsx and Data (2).xlsx.
 */
import prisma from '../db';

const XLSX = require('xlsx');

interface RawConsultant {
  fullName: string;
  email: string | null;
  phone: string | null;
  technology: string | null;
  visa: string | null;
  experience: number | null;
  linkedIn: string | null;
  source: string;
}

function cleanPhone(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (s.length < 7) return null;
  return s;
}

function cleanEmail(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s.includes('@')) return null;
  return s;
}

function cleanName(raw: any): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (s.length < 2 || s === 'XYZ' || s === 'N/A' || s === 'NA') return null;
  return s;
}

function splitSkills(tech: string | null): string[] {
  if (!tech) return [];
  return tech
    .split(/[|/,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length < 40);
}

/**
 * "All Tek" / "Sheet1": [Name, MOBILE NO, TECHNOLOGY, visa?, E MAIL ID, EXPERIENCE]
 */
function parseAllTek(rows: any[][], source: string): RawConsultant[] {
  const results: RawConsultant[] = [];
  const startIdx = rows[0]?.[0] === 'Name' ? 1 : 0;
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const name = cleanName(row[0]);
    if (!name) continue;
    results.push({
      fullName: name,
      phone: cleanPhone(row[1]),
      technology: row[2] ? String(row[2]).trim() : null,
      visa: row[3] ? String(row[3]).trim() : null,
      email: cleanEmail(row[4]),
      experience: typeof row[5] === 'number' ? row[5] : null,
      linkedIn: null,
      source,
    });
  }
  return results;
}

/**
 * "LinkedIn": [Candidate Name, Position, Response Given, LinkedIn URL, contact]
 */
function parseLinkedIn(rows: any[][], source: string): RawConsultant[] {
  const results: RawConsultant[] = [];
  const startIdx = rows[0]?.[0] === 'Candidate Name' ? 1 : 0;
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const name = cleanName(row[0]);
    if (!name) continue;
    const linkedIn = row[3] && String(row[3]).includes('linkedin.com') ? String(row[3]).trim() : null;
    results.push({
      fullName: name,
      phone: cleanPhone(row[4]),
      technology: row[1] ? String(row[1]).trim() : null,
      visa: null,
      email: null,
      experience: null,
      linkedIn,
      source,
    });
  }
  return results;
}

/**
 * "Placed": [Consultant Full Name, Client, Middle-Client, End-Client]
 */
function parsePlaced(rows: any[][], source: string): RawConsultant[] {
  const results: RawConsultant[] = [];
  const startIdx = rows[0]?.[0]?.toString().includes('Consultant') ? 1 : 0;
  for (let i = startIdx; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const name = cleanName(row[0]);
    if (!name) continue;
    results.push({
      fullName: name,
      phone: null,
      technology: null,
      visa: null,
      email: null,
      experience: null,
      linkedIn: null,
      source,
    });
  }
  return results;
}

/**
 * "Data" / "Sheet2": [Name, Email, Phone, Visa/Status]
 */
function parseDataSheet(rows: any[][], source: string): RawConsultant[] {
  const results: RawConsultant[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const name = cleanName(row[0]);
    if (!name) continue;
    results.push({
      fullName: name,
      email: cleanEmail(row[1]),
      phone: cleanPhone(row[2]),
      technology: null,
      visa: row[3] ? String(row[3]).trim() : null,
      experience: null,
      linkedIn: null,
      source,
    });
  }
  return results;
}

/**
 * "All Tech": [Name, Phone, Email, visa?, Technology]
 */
function parseAllTech(rows: any[][], source: string): RawConsultant[] {
  const results: RawConsultant[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const name = cleanName(row[0]);
    if (!name) continue;
    results.push({
      fullName: name,
      phone: cleanPhone(row[1]),
      email: cleanEmail(row[2]),
      visa: row[3] ? String(row[3]).trim() : null,
      technology: row[4] ? String(row[4]).trim() : null,
      experience: null,
      linkedIn: null,
      source,
    });
  }
  return results;
}

/**
 * "AWS" / "Sheet5": [Name, Phone, Email, visa?, ?, Technology]
 */
function parseAWS(rows: any[][], source: string): RawConsultant[] {
  const results: RawConsultant[] = [];
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[0]) continue;
    const name = cleanName(row[0]);
    if (!name) continue;
    results.push({
      fullName: name,
      phone: cleanPhone(row[1]),
      email: cleanEmail(row[2]),
      visa: row[3] ? String(row[3]).trim() : null,
      technology: row[5] ? String(row[5]).trim() : (row[4] ? String(row[4]).trim() : null),
      experience: null,
      linkedIn: null,
      source,
    });
  }
  return results;
}

function parseSheet(sheetName: string, rows: any[][], fileName: string): RawConsultant[] {
  const source = `${fileName}/${sheetName}`;
  const normalized = sheetName.toLowerCase().trim();

  if (normalized === 'all tek' || normalized === 'sheet1') return parseAllTek(rows, source);
  if (normalized === 'linkedin') return parseLinkedIn(rows, source);
  if (normalized === 'placed') return parsePlaced(rows, source);
  if (normalized === 'data' || normalized === 'sheet2') return parseDataSheet(rows, source);
  if (normalized === 'all tech') return parseAllTech(rows, source);
  if (normalized === 'aws' || normalized === 'sheet5') return parseAWS(rows, source);

  console.log(`[SpreadsheetImport] Unknown sheet "${sheetName}" — skipping`);
  return [];
}

export async function importSpreadsheets(files: string[]): Promise<{ total: number; inserted: number; updated: number; skipped: number }> {
  let total = 0;
  let inserted = 0;
  let updated = 0;
  let skipped = 0;

  const allConsultants: RawConsultant[] = [];

  for (const filePath of files) {
    const fileName = filePath.split('/').pop() ?? filePath;
    console.log(`[SpreadsheetImport] Reading ${fileName}...`);

    const wb = XLSX.readFile(filePath);
    for (const sheetName of wb.SheetNames) {
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      const parsed = parseSheet(sheetName, rows, fileName);
      console.log(`  Sheet "${sheetName}": ${parsed.length} consultants parsed`);
      allConsultants.push(...parsed);
    }
  }

  total = allConsultants.length;
  console.log(`[SpreadsheetImport] Total parsed: ${total}. Upserting into database...`);

  // Deduplicate by email first, then by name+phone
  const seen = new Map<string, boolean>();

  for (let i = 0; i < allConsultants.length; i++) {
    const c = allConsultants[i]!;

    // Build dedup key
    const dedupKey = c.email
      ? `email:${c.email}`
      : c.phone
        ? `phone:${c.phone}`
        : `name:${c.fullName.toLowerCase().replace(/\s+/g, '')}`;

    if (seen.has(dedupKey)) {
      skipped++;
      continue;
    }
    seen.set(dedupKey, true);

    try {
      const skills = splitSkills(c.technology);

      if (c.email) {
        const existing = await prisma.extractedConsultant.findUnique({
          where: { email: c.email },
        });

        if (existing) {
          // Merge skills and update missing fields
          const existingSkills = existing.primarySkills ?? [];
          const mergedSkills = [...new Set([...existingSkills, ...skills])];
          await prisma.extractedConsultant.update({
            where: { id: existing.id },
            data: {
              fullName: existing.fullName ?? c.fullName,
              phone: existing.phone ?? c.phone,
              location: existing.location ?? null,
              primarySkills: mergedSkills,
              sourceType: 'SPREADSHEET',
              lastSeenAt: new Date(),
            },
          });
          updated++;
        } else {
          await prisma.extractedConsultant.create({
            data: {
              fullName: c.fullName,
              email: c.email,
              phone: c.phone,
              primarySkills: skills,
              sourceType: 'SPREADSHEET',
              lastSeenAt: new Date(),
            },
          });
          inserted++;
        }
      } else {
        // No email — create with placeholder or skip if too sparse
        if (!c.phone && !c.linkedIn && skills.length === 0) {
          skipped++;
          continue;
        }

        const placeholder = c.phone
          ? `phone-${c.phone.replace(/\D/g, '')}@placeholder.local`
          : `sheet-${dedupKey.replace(/[^a-z0-9]/gi, '')}@placeholder.local`;

        const existing = await prisma.extractedConsultant.findUnique({
          where: { email: placeholder },
        });

        if (existing) {
          const mergedSkills = [...new Set([...(existing.primarySkills ?? []), ...skills])];
          await prisma.extractedConsultant.update({
            where: { id: existing.id },
            data: {
              fullName: existing.fullName ?? c.fullName,
              phone: existing.phone ?? c.phone,
              primarySkills: mergedSkills,
              lastSeenAt: new Date(),
            },
          });
          updated++;
        } else {
          await prisma.extractedConsultant.create({
            data: {
              fullName: c.fullName,
              email: placeholder,
              phone: c.phone,
              primarySkills: skills,
              sourceType: 'SPREADSHEET',
              lastSeenAt: new Date(),
            },
          });
          inserted++;
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('Unique constraint')) {
        updated++;
      } else {
        skipped++;
        if (skipped <= 10) {
          console.error(`[SpreadsheetImport] Error for "${c.fullName}": ${String(err?.message ?? err).slice(0, 150)}`);
        }
      }
    }

    if ((inserted + updated + skipped) % 500 === 0) {
      console.log(`[SpreadsheetImport] Progress: ${inserted} new, ${updated} updated, ${skipped} skipped / ${total} total`);
    }
  }

  console.log(`[SpreadsheetImport] Done: ${inserted} new, ${updated} updated, ${skipped} skipped / ${total} total`);
  return { total, inserted, updated, skipped };
}
