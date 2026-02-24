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

@Injectable()
export class ApolloService {
  private readonly logger = new Logger(ApolloService.name);

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

    const contacts = await this.prisma.$queryRaw`
      SELECT vct.id, vct.email, vct.name, vc.domain, vc.name as company_name,
        vts.trust_score
      FROM vendor_contact vct
      JOIN vendor_company vc ON vc.id = vct.vendor_company_id
      LEFT JOIN vendor_trust_score vts ON vts.vendor_company_id = vc.id
      WHERE vct.email IS NOT NULL AND vct.email != ''
        AND NOT EXISTS (
          SELECT 1 FROM vendor_contact_enrichment e WHERE e.contact_email = vct.email
        )
      ORDER BY COALESCE(vts.trust_score, 0) DESC
      LIMIT ${limit}
    ` as any[];

    let enriched = 0;
    const results: any[] = [];

    for (const contact of contacts) {
      try {
        const person = await this.enrichEmail(contact.email);
        if (person) {
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
          enriched++;
          results.push({
            email: contact.email,
            name: `${person.first_name || ''} ${person.last_name || ''}`.trim(),
            title: person.title,
            linkedin: person.linkedin_url,
            company: person.organization?.name,
          });
        }
        // Rate limit: 1 req/sec for Apollo
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
      } catch { /* skip */ }
    }

    return { domain, found: people.length, stored };
  }
}
