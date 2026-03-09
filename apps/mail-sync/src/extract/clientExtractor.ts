import { Pool } from "pg";

function getDomain(email: string): string | null {
  const parts = email.toLowerCase().trim().split("@");
  return parts.length === 2 ? parts[1] : null;
}

function guessCompanyName(domain: string): string {
  const name = domain.split(".")[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export async function extractClients(pool: Pool, incrementalOnly = false): Promise<void> {
  console.log(`\n=== Client Extraction${incrementalOnly ? ' (incremental)' : ''} ===\n`);
  console.log("  SKIPPED — Prisma 'ClientCompany' schema differs from legacy client_company/client_contact tables.");
  return;
}
