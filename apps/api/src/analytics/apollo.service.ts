import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

interface ApolloContact {
  email?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  title?: string;
  linkedin_url?: string;
  organization?: { name?: string; website_url?: string; industry?: string };
  phone_numbers?: Array<{ raw_number?: string }>;
  city?: string;
  state?: string;
}

interface EnrichmentProgress {
  running: boolean;
  phase: string;
  vendorsProcessed: number;
  vendorsTotal: number;
  vendorContactsProcessed: number;
  vendorContactsTotal: number;
  consultantsProcessed: number;
  consultantsTotal: number;
  enriched: number;
  failed: number;
  startedAt: string | null;
  lastUpdate: string;
}

@Injectable()
export class ApolloService {
  private readonly logger = new Logger(ApolloService.name);

  private progress: EnrichmentProgress = {
    running: false, phase: 'idle',
    vendorsProcessed: 0, vendorsTotal: 0,
    vendorContactsProcessed: 0, vendorContactsTotal: 0,
    consultantsProcessed: 0, consultantsTotal: 0,
    enriched: 0, failed: 0,
    startedAt: null, lastUpdate: new Date().toISOString(),
  };

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  private get searchKey() {
    return this.config.get<string>('APOLLO_SEARCH_KEY') ?? '';
  }

  private get enrichKey() {
    return this.config.get<string>('APOLLO_ENRICH_KEY') ?? '';
  }

  isConfigured(): boolean {
    return this.searchKey.length > 0 || this.enrichKey.length > 0;
  }

  /**
   * Search Apollo for contacts at a specific domain.
   * Use for high-trust / high-value vendor domains to find decision-makers.
   */
  async searchContacts(domain: string, limit = 5): Promise<ApolloContact[]> {
    if (!this.searchKey) {
      throw new Error('APOLLO_SEARCH_KEY not configured');
    }

    try {
      const res = await fetch('https://api.apollo.io/v1/mixed_people/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.searchKey,
        },
        body: JSON.stringify({
          q_organization_domains: domain,
          page: 1,
          per_page: limit,
          person_titles: ['recruiter', 'talent acquisition', 'staffing', 'hiring manager', 'hr', 'human resources'],
        }),
      });

      if (!res.ok) {
        const errorText = await res.text();
        const isFreeLimit = errorText.includes('free plan') || errorText.includes('API_INACCESSIBLE');
        this.logger.warn(`Apollo search failed for ${domain}: ${res.status}${isFreeLimit ? ' (requires paid Apollo plan)' : ''} ${errorText}`);
        return [];
      }

      const data: any = await res.json();
      return (data.people || []) as ApolloContact[];
    } catch (err: any) {
      this.logger.error(`Apollo search error: ${err.message}`);
      return [];
    }
  }

  /**
   * Enrich a single email address with Apollo data.
   */
  async enrichEmail(email: string): Promise<ApolloContact | null> {
    if (!this.enrichKey) {
      throw new Error('APOLLO_ENRICH_KEY not configured');
    }

    try {
      const res = await fetch('https://api.apollo.io/v1/people/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.enrichKey,
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const errorBody = await res.text().catch(() => '');
        const isFreeLimit = errorBody.includes('free plan') || errorBody.includes('API_INACCESSIBLE');
        this.logger.warn(`Apollo enrich failed for ${email}: ${res.status}${isFreeLimit ? ' (requires paid Apollo plan)' : ''}`);
        return null;
      }

      const data: any = await res.json();
      return (data.person || null) as ApolloContact | null;
    } catch (err: any) {
      this.logger.error(`Apollo enrich error: ${err.message}`);
      return null;
    }
  }

  /**
   * Enrich top vendor contacts — high-trust vendors first.
   * Stores enriched data back into vendor_contact.
   */
  async enrichTopVendorContacts(limit = 20) {
    try {
      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS vendor_contact_enrichment (
          id SERIAL PRIMARY KEY,
          contact_email TEXT NOT NULL UNIQUE,
          vendor_domain TEXT,
          first_name TEXT,
          last_name TEXT,
          title TEXT,
          linkedin_url TEXT,
          phone TEXT,
          company_name TEXT,
          industry TEXT,
          city TEXT,
          state TEXT,
          enriched_at TIMESTAMPTZ DEFAULT NOW(),
          source TEXT DEFAULT 'apollo'
        )
      `;
    } catch {
      // vendor_contact_enrichment table cannot be created
    }

    let contacts: any[] = [];
    try {
      contacts = await this.prisma.$queryRaw`
        SELECT vct.id, vct.email, vct.name, vc.domain, vc.name as company_name,
          v."trustScore" as trust_score
        FROM "ExtractedVendorContact" vct
        JOIN "ExtractedVendorCompany" vc ON vc.id = vct."vendorCompanyId"
        LEFT JOIN "Vendor" v ON v.domain = vc.domain
        WHERE vct.email IS NOT NULL AND vct.email != ''
        ORDER BY COALESCE(v."trustScore", 0) DESC
        LIMIT ${limit}
      ` as any[];
    } catch (err: any) {
      this.logger.warn(`enrichTopVendorContacts query failed: ${err.message?.slice(0, 120)}`);
      return { attempted: 0, enriched: 0, results: [] };
    }

    let enriched = 0;
    const results: any[] = [];

    for (const contact of contacts) {
      try {
        const person = await this.enrichEmail(contact.email);
        if (person) {
          try {
            await this.prisma.$executeRaw`
              INSERT INTO vendor_contact_enrichment
                (contact_email, vendor_domain, first_name, last_name, title,
                 linkedin_url, phone, company_name, industry, city, state, source)
              VALUES (
                ${contact.email}, ${contact.domain},
                ${person.first_name || null}, ${person.last_name || null},
                ${person.title || null}, ${person.linkedin_url || null},
                ${person.phone_numbers?.[0]?.raw_number || null},
                ${person.organization?.name || contact.company_name},
                ${person.organization?.industry || null},
                ${person.city || null}, ${person.state || null},
                'apollo'
              )
              ON CONFLICT (contact_email) DO UPDATE SET
                first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
                title = EXCLUDED.title, linkedin_url = EXCLUDED.linkedin_url,
                phone = EXCLUDED.phone, enriched_at = NOW()
            `;
          } catch {
            // vendor_contact_enrichment table may not exist
          }
          enriched++;
          results.push({
            email: contact.email,
            name: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
            title: person.title,
            linkedin: person.linkedin_url,
            company: person.organization?.name,
          });
        }
        await new Promise(r => setTimeout(r, 1100));
      } catch (err: any) {
        this.logger.warn(`Enrich failed for ${contact.email}: ${err.message}`);
      }
    }

    return { attempted: contacts.length, enriched, results };
  }

  /**
   * Search for contacts at a specific vendor domain.
   * Useful for discovering decision-makers at high-value vendors.
   */
  async discoverVendorContacts(domain: string) {
    try {
      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS vendor_contact_enrichment (
          id SERIAL PRIMARY KEY,
          contact_email TEXT NOT NULL UNIQUE,
          vendor_domain TEXT,
          first_name TEXT,
          last_name TEXT,
          title TEXT,
          linkedin_url TEXT,
          phone TEXT,
          company_name TEXT,
          industry TEXT,
          city TEXT,
          state TEXT,
          enriched_at TIMESTAMPTZ DEFAULT NOW(),
          source TEXT DEFAULT 'apollo'
        )
      `;
    } catch {
      // vendor_contact_enrichment table cannot be created
    }

    const people = await this.searchContacts(domain, 10);

    let stored = 0;
    for (const person of people) {
      if (!person.email) continue;
      try {
        await this.prisma.$executeRaw`
          INSERT INTO vendor_contact_enrichment
            (contact_email, vendor_domain, first_name, last_name, title,
             linkedin_url, phone, company_name, industry, city, state, source)
          VALUES (
            ${person.email}, ${domain},
            ${person.first_name || null}, ${person.last_name || null},
            ${person.title || null}, ${person.linkedin_url || null},
            ${person.phone_numbers?.[0]?.raw_number || null},
            ${person.organization?.name || domain},
            ${person.organization?.industry || null},
            ${person.city || null}, ${person.state || null},
            'apollo-search'
          )
          ON CONFLICT (contact_email) DO UPDATE SET
            title = EXCLUDED.title, linkedin_url = EXCLUDED.linkedin_url,
            phone = EXCLUDED.phone, enriched_at = NOW()
        `;
        stored++;
      } catch {
        // vendor_contact_enrichment table may not exist
      }
    }

    return { domain, found: people.length, stored };
  }

  getEnrichmentProgress(): EnrichmentProgress {
    return { ...this.progress };
  }

  /**
   * Full database scan enrichment: vendors → vendor contacts → consultants.
   * No limits - processes ALL unenriched records. Stops if Apollo credits exhausted.
   */
  async bulkEnrichAll(options?: { vendorLimit?: number; contactLimit?: number; consultantLimit?: number }) {
    if (this.progress.running) {
      return { status: 'already_running', progress: this.progress };
    }

    this.progress = {
      running: true, phase: 'starting',
      vendorsProcessed: 0, vendorsTotal: 0,
      vendorContactsProcessed: 0, vendorContactsTotal: 0,
      consultantsProcessed: 0, consultantsTotal: 0,
      enriched: 0, failed: 0,
      startedAt: new Date().toISOString(),
      lastUpdate: new Date().toISOString(),
    };

    this.runFullDatabaseEnrichment().catch((err) => {
      this.logger.error(`Bulk enrichment failed: ${err.message}`);
      this.progress.running = false;
      this.progress.phase = `error: ${err.message}`;
      this.progress.lastUpdate = new Date().toISOString();
    });

    return { status: 'started', progress: this.progress };
  }

  private consecutiveFailures = 0;

  private async runFullDatabaseEnrichment() {
    await this.ensureEnrichmentTable();
    this.consecutiveFailures = 0;

    // ── Phase 1: ALL vendors missing contact names ──
    this.progress.phase = 'vendors';
    this.progress.lastUpdate = new Date().toISOString();

    const vendorsToEnrich = await this.prisma.$queryRaw`
      SELECT v.id, v."companyName", v.domain, v."contactEmail", v."contactName"
      FROM "Vendor" v
      WHERE v.domain IS NOT NULL AND v.domain != ''
        AND (v."contactName" IS NULL OR v."contactName" = '' OR LENGTH(v."contactName") < 3)
        AND NOT EXISTS (SELECT 1 FROM vendor_contact_enrichment e WHERE e.contact_email = v."contactEmail")
      ORDER BY COALESCE(v."trustScore", 0) DESC
    ` as any[];

    this.progress.vendorsTotal = vendorsToEnrich.length;
    this.logger.log(`[BulkEnrich] Phase 1: ${vendorsToEnrich.length} vendors to enrich (ALL)`);

    for (const vendor of vendorsToEnrich) {
      if (this.shouldStopDueToCredits()) break;
      try {
        const person = vendor.contactEmail
          ? await this.enrichEmail(vendor.contactEmail)
          : null;

        if (person) {
          const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim();
          const phone = person.phone_numbers?.[0]?.raw_number || null;
          await this.prisma.$executeRaw`
            UPDATE "Vendor" SET
              "contactName" = COALESCE(NULLIF(${fullName}, ''), "contactName"),
              "updatedAt" = NOW()
            WHERE id = ${vendor.id}
          `;
          await this.storeEnrichment(vendor.contactEmail || vendor.domain, vendor.domain, person);
          this.progress.enriched++;
          this.consecutiveFailures = 0;
        } else if (vendor.domain) {
          const people = await this.searchContacts(vendor.domain, 3);
          if (people.length > 0) {
            const best = people[0]!;
            const fullName = `${best.first_name || ''} ${best.last_name || ''}`.trim();
            await this.prisma.$executeRaw`
              UPDATE "Vendor" SET
                "contactName" = COALESCE(NULLIF(${fullName}, ''), "contactName"),
                "contactEmail" = COALESCE(NULLIF(${best.email || ''}, ''), "contactEmail"),
                "updatedAt" = NOW()
              WHERE id = ${vendor.id}
            `;
            for (const p of people) {
              if (p.email) await this.storeEnrichment(p.email, vendor.domain, p);
            }
            this.progress.enriched++;
            this.consecutiveFailures = 0;
          }
        }
      } catch (err: any) {
        this.progress.failed++;
        this.consecutiveFailures++;
        this.logger.warn(`Vendor enrich failed ${vendor.domain}: ${err.message}`);
        if (this.isCreditsExhausted(err)) break;
      }
      this.progress.vendorsProcessed++;
      this.progress.lastUpdate = new Date().toISOString();
      await this.rateLimit();
    }

    if (this.shouldStopDueToCredits()) {
      this.finishWithMessage('stopped_credits_exhausted');
      return;
    }

    // ── Phase 2: ALL vendor contacts (enrich by email) ──
    this.progress.phase = 'vendor_contacts';
    this.progress.lastUpdate = new Date().toISOString();

    const contactsToEnrich = await this.prisma.$queryRaw`
      SELECT vct.id, vct.email, vct.name, vct."emailCount", vc.domain, vc.name as company_name
      FROM "ExtractedVendorContact" vct
      JOIN "ExtractedVendorCompany" vc ON vc.id = vct."vendorCompanyId"
      LEFT JOIN "Vendor" v ON v.domain = vc.domain
      WHERE vct.email IS NOT NULL AND vct.email != ''
        AND NOT EXISTS (SELECT 1 FROM vendor_contact_enrichment e WHERE e.contact_email = vct.email)
      ORDER BY COALESCE(v."trustScore", 0) DESC, vct."emailCount" DESC NULLS LAST
    ` as any[];

    this.progress.vendorContactsTotal = contactsToEnrich.length;
    this.logger.log(`[BulkEnrich] Phase 2: ${contactsToEnrich.length} vendor contacts to enrich (ALL)`);

    for (const contact of contactsToEnrich) {
      if (this.shouldStopDueToCredits()) break;
      try {
        const person = await this.enrichEmail(contact.email);
        if (person) {
          await this.storeEnrichment(contact.email, contact.domain, person);
          const fullName = `${person.first_name || ''} ${person.last_name || ''}`.trim();
          const phone = person.phone_numbers?.[0]?.raw_number || null;
          if (fullName && (!contact.name || contact.name.length < 3)) {
            await this.prisma.$executeRaw`
              UPDATE "ExtractedVendorContact" SET
                name = ${fullName},
                phone = COALESCE(NULLIF(${phone || ''}, ''), phone),
                "linkedIn" = COALESCE(NULLIF(${person.linkedin_url || ''}, ''), "linkedIn"),
                "updatedAt" = NOW()
              WHERE id = ${contact.id}
            `;
          } else if (phone || person.linkedin_url) {
            await this.prisma.$executeRaw`
              UPDATE "ExtractedVendorContact" SET
                phone = COALESCE(NULLIF(${phone || ''}, ''), phone),
                "linkedIn" = COALESCE(NULLIF(${person.linkedin_url || ''}, ''), "linkedIn"),
                "updatedAt" = NOW()
              WHERE id = ${contact.id}
            `;
          }
          this.progress.enriched++;
          this.consecutiveFailures = 0;
        }
      } catch (err: any) {
        this.progress.failed++;
        this.consecutiveFailures++;
        this.logger.warn(`Contact enrich failed ${contact.email}: ${err.message}`);
        if (this.isCreditsExhausted(err)) break;
      }
      this.progress.vendorContactsProcessed++;
      this.progress.lastUpdate = new Date().toISOString();
      await this.rateLimit();
    }

    if (this.shouldStopDueToCredits()) {
      this.finishWithMessage('stopped_credits_exhausted');
      return;
    }

    // ── Phase 3: ALL consultants missing phone/details ──
    this.progress.phase = 'consultants';
    this.progress.lastUpdate = new Date().toISOString();

    const consultantsToEnrich = await this.prisma.$queryRaw`
      SELECT c.id, c.email, c."firstName", c."lastName", c.phone
      FROM "Consultant" c
      WHERE c.email IS NOT NULL AND c.email != ''
        AND (c.phone IS NULL OR c.phone = '')
        AND NOT EXISTS (SELECT 1 FROM vendor_contact_enrichment e WHERE e.contact_email = c.email)
      ORDER BY c."qualityScore" DESC NULLS LAST
    ` as any[];

    this.progress.consultantsTotal = consultantsToEnrich.length;
    this.logger.log(`[BulkEnrich] Phase 3: ${consultantsToEnrich.length} consultants to enrich (ALL)`);

    for (const consultant of consultantsToEnrich) {
      if (this.shouldStopDueToCredits()) break;
      try {
        const person = await this.enrichEmail(consultant.email);
        if (person) {
          const phone = person.phone_numbers?.[0]?.raw_number || null;
          const linkedin = person.linkedin_url || null;
          if (phone || linkedin) {
            await this.prisma.$executeRaw`
              UPDATE "Consultant" SET
                phone = COALESCE(NULLIF(${phone || ''}, ''), phone),
                "updatedAt" = NOW()
              WHERE id = ${consultant.id}
            `;
          }
          await this.storeEnrichment(consultant.email, null, person);
          this.progress.enriched++;
          this.consecutiveFailures = 0;
        }
      } catch (err: any) {
        this.progress.failed++;
        this.consecutiveFailures++;
        this.logger.warn(`Consultant enrich failed ${consultant.email}: ${err.message}`);
        if (this.isCreditsExhausted(err)) break;
      }
      this.progress.consultantsProcessed++;
      this.progress.lastUpdate = new Date().toISOString();
      await this.rateLimit();
    }

    this.finishWithMessage('complete');
  }

  private isCreditsExhausted(err: any): boolean {
    const msg = err?.message?.toLowerCase() || '';
    return msg.includes('credit') || msg.includes('rate limit') || msg.includes('429')
      || msg.includes('quota') || msg.includes('api_inaccessible');
  }

  private shouldStopDueToCredits(): boolean {
    return this.consecutiveFailures >= 10;
  }

  private finishWithMessage(status: string) {
    this.progress.phase = status;
    this.progress.running = false;
    this.progress.lastUpdate = new Date().toISOString();
    this.logger.log(`[BulkEnrich] Finished (${status}): ${this.progress.enriched} enriched, ${this.progress.failed} failed`);
  }

  private async ensureEnrichmentTable() {
    try {
      await this.prisma.$executeRaw`
        CREATE TABLE IF NOT EXISTS vendor_contact_enrichment (
          id SERIAL PRIMARY KEY,
          contact_email TEXT NOT NULL UNIQUE,
          vendor_domain TEXT,
          first_name TEXT, last_name TEXT, title TEXT,
          linkedin_url TEXT, phone TEXT,
          company_name TEXT, industry TEXT,
          city TEXT, state TEXT,
          enriched_at TIMESTAMPTZ DEFAULT NOW(),
          source TEXT DEFAULT 'apollo'
        )
      `;
    } catch { /* already exists */ }
  }

  private async storeEnrichment(email: string, domain: string | null, person: ApolloContact) {
    try {
      await this.prisma.$executeRaw`
        INSERT INTO vendor_contact_enrichment
          (contact_email, vendor_domain, first_name, last_name, title,
           linkedin_url, phone, company_name, industry, city, state, source)
        VALUES (
          ${email}, ${domain},
          ${person.first_name || null}, ${person.last_name || null},
          ${person.title || null}, ${person.linkedin_url || null},
          ${person.phone_numbers?.[0]?.raw_number || null},
          ${person.organization?.name || null},
          ${person.organization?.industry || null},
          ${person.city || null}, ${person.state || null},
          'apollo'
        )
        ON CONFLICT (contact_email) DO UPDATE SET
          first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
          title = EXCLUDED.title, linkedin_url = EXCLUDED.linkedin_url,
          phone = EXCLUDED.phone, company_name = EXCLUDED.company_name,
          enriched_at = NOW()
      `;
    } catch { /* table may not exist */ }
  }

  private rateLimit(): Promise<void> {
    return new Promise(r => setTimeout(r, 1200));
  }
}
