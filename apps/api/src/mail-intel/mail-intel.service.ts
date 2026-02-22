import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MailIntelService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const [
      emailStats,
      categoryBreakdown,
      mailboxStats,
      entityCounts,
      empTypeBreakdown,
      latestReqs,
    ] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT COUNT(*)::int as "totalEmails",
               COUNT(DISTINCT from_email)::int as "uniqueSenders",
               COUNT(DISTINCT mailbox_email)::int as "mailboxCount",
               MIN(sent_at) as "oldestEmail",
               MAX(sent_at) as "newestEmail"
        FROM raw_email_message
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT category, COUNT(*)::int as count
        FROM raw_email_message WHERE category IS NOT NULL
        GROUP BY category ORDER BY count DESC
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT mailbox_email as email, COUNT(*)::int as count,
               MIN(sent_at) as "oldestEmail", MAX(sent_at) as "newestEmail"
        FROM raw_email_message GROUP BY mailbox_email ORDER BY count DESC
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT
          (SELECT COUNT(*)::int FROM vendor_company WHERE name NOT LIKE '[SYSTEM]%') as "vendorCompanies",
          (SELECT COUNT(*)::int FROM vendor_contact) as "vendorContacts",
          (SELECT COUNT(*)::int FROM client_company) as "clientCompanies",
          (SELECT COUNT(*)::int FROM client_contact) as "clientContacts",
          (SELECT COUNT(*)::int FROM consultant) as "consultants",
          (SELECT COUNT(*)::int FROM vendor_req_signal) as "reqSignals"
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT employment_type as type, COUNT(*)::int as count
        FROM vendor_req_signal WHERE employment_type IS NOT NULL
        GROUP BY employment_type ORDER BY count DESC
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT vrs.id, vrs.title, vrs.location, vrs.rate_text as "rateText",
               vrs.employment_type as "employmentType", vrs.skills,
               vrs.created_at as "createdAt",
               vc.domain as "vendorDomain", vc.name as "vendorName",
               vct.email as "contactEmail"
        FROM vendor_req_signal vrs
        LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
        LEFT JOIN vendor_contact vct ON vct.id = vrs.vendor_contact_id
        ORDER BY vrs.created_at DESC LIMIT 20
      ` as Promise<any[]>,
    ]);

    return {
      ...emailStats[0],
      ...entityCounts[0],
      categories: categoryBreakdown,
      mailboxes: mailboxStats,
      employmentTypes: empTypeBreakdown,
      latestReqs,
    };
  }

  async getVendors(page = 1, pageSize = 25, search?: string, dateFrom?: string, dateTo?: string) {
    const offset = (page - 1) * pageSize;
    const conditions: string[] = ["vc.name NOT LIKE '[SYSTEM]%'"];
    const params: any[] = [];
    let idx = 1;

    if (search) {
      conditions.push(`to_tsvector('english', coalesce(vc.name,'') || ' ' || coalesce(vc.domain,'')) @@ plainto_tsquery('english', $${idx})`);
      params.push(search);
      idx++;
    }
    if (dateFrom) {
      conditions.push(`vc.last_seen >= $${idx}::timestamptz`);
      params.push(dateFrom);
      idx++;
    }
    if (dateTo) {
      conditions.push(`vc.last_seen <= $${idx}::timestamptz`);
      params.push(dateTo);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataParams = [...params, pageSize, offset];
    const vendors = await this.prisma.$queryRawUnsafe(`
      SELECT vc.id, vc.domain, vc.name, vc.email_count as "emailCount",
             vc.first_seen as "firstSeen", vc.last_seen as "lastSeen",
             (SELECT COUNT(*)::int FROM vendor_contact vct WHERE vct.vendor_company_id = vc.id) as "contactCount",
             (SELECT COUNT(*)::int FROM vendor_req_signal vr WHERE vr.vendor_company_id = vc.id) as "reqCount"
      FROM vendor_company vc ${where}
      ORDER BY vc.email_count DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, ...dataParams);

    const totalResult = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM vendor_company vc ${where}`,
      ...params,
    ) as any[];

    return {
      data: vendors,
      pagination: { page, pageSize, total: totalResult[0].total, totalPages: Math.ceil(totalResult[0].total / pageSize) },
    };
  }

  async getVendorDetail(id: string) {
    const [company] = await this.prisma.$queryRaw`
      SELECT vc.id, vc.domain, vc.name, vc.email_count as "emailCount",
             vc.first_seen as "firstSeen", vc.last_seen as "lastSeen"
      FROM vendor_company vc WHERE vc.id = ${id}::uuid
    ` as any[];

    if (!company) return null;

    const [contacts, recentReqs, topSkills] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT vct.id, vct.name, vct.email, vct.email_count as "emailCount",
               vct.first_seen as "firstSeen", vct.last_seen as "lastSeen"
        FROM vendor_contact vct WHERE vct.vendor_company_id = ${id}::uuid
        ORDER BY vct.email_count DESC LIMIT 50
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT vrs.id, vrs.title, vrs.location, vrs.rate_text as "rateText",
               vrs.employment_type as "employmentType", vrs.skills,
               vrs.created_at as "createdAt",
               vct.email as "contactEmail", vct.name as "contactName"
        FROM vendor_req_signal vrs
        LEFT JOIN vendor_contact vct ON vct.id = vrs.vendor_contact_id
        WHERE vrs.vendor_company_id = ${id}::uuid
        ORDER BY vrs.created_at DESC LIMIT 50
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT skill as name, COUNT(*)::int as count
        FROM vendor_req_signal vrs, unnest(vrs.skills) as skill
        WHERE vrs.vendor_company_id = ${id}::uuid
        GROUP BY skill ORDER BY count DESC LIMIT 15
      ` as Promise<any[]>,
    ]);

    return { ...company, contacts, recentReqs, topSkills };
  }

  async getVendorContacts(vendorId?: string, page = 1, pageSize = 25, search?: string) {
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (vendorId) {
      conditions.push(`vct.vendor_company_id = $${idx}::uuid`);
      params.push(vendorId);
      idx++;
    }
    if (search) {
      conditions.push(`to_tsvector('english', coalesce(vct.name,'') || ' ' || coalesce(vct.email,'')) @@ plainto_tsquery('english', $${idx})`);
      params.push(search);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataParams = [...params, pageSize, offset];

    const contacts = await this.prisma.$queryRawUnsafe(`
      SELECT vct.id, vct.name, vct.email, vct.email_count as "emailCount",
             vct.first_seen as "firstSeen", vct.last_seen as "lastSeen",
             vc.domain as "vendorDomain", vc.name as "vendorName"
      FROM vendor_contact vct
      JOIN vendor_company vc ON vc.id = vct.vendor_company_id
      ${where}
      ORDER BY vct.email_count DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, ...dataParams);

    const totalResult = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM vendor_contact vct ${where}`,
      ...params,
    ) as any[];

    return {
      data: contacts,
      pagination: { page, pageSize, total: totalResult[0].total, totalPages: Math.ceil(totalResult[0].total / pageSize) },
    };
  }

  async getConsultants(page = 1, pageSize = 25, search?: string, dateFrom?: string, dateTo?: string) {
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (search) {
      conditions.push(`(to_tsvector('english', coalesce(c.full_name,'') || ' ' || coalesce(c.email,'') || ' ' || coalesce(c.phone,'')) @@ plainto_tsquery('english', $${idx}) OR $${idx} = ANY(c.primary_skills))`);
      params.push(search);
      idx++;
    }
    if (dateFrom) {
      conditions.push(`c.last_seen >= $${idx}::timestamptz`);
      params.push(dateFrom);
      idx++;
    }
    if (dateTo) {
      conditions.push(`c.last_seen <= $${idx}::timestamptz`);
      params.push(dateTo);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataParams = [...params, pageSize, offset];

    const consultants = await this.prisma.$queryRawUnsafe(`
      SELECT c.id, c.full_name as "fullName", c.email, c.phone,
             c.primary_skills as "skills",
             c.first_seen as "firstSeen", c.last_seen as "lastSeen"
      FROM consultant c ${where}
      ORDER BY c.last_seen DESC NULLS LAST
      LIMIT $${idx} OFFSET $${idx + 1}
    `, ...dataParams);

    const totalResult = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM consultant c ${where}`,
      ...params,
    ) as any[];

    return {
      data: consultants,
      pagination: { page, pageSize, total: totalResult[0].total, totalPages: Math.ceil(totalResult[0].total / pageSize) },
    };
  }

  async getConsultantDetail(id: string) {
    const [consultant] = await this.prisma.$queryRaw`
      SELECT c.id, c.full_name as "fullName", c.email, c.phone,
             c.primary_skills as "skills",
             c.first_seen as "firstSeen", c.last_seen as "lastSeen",
             c.source_email_id as "sourceEmailId"
      FROM consultant c WHERE c.id = ${id}::uuid
    ` as any[];

    if (!consultant) return null;

    const relatedReqs = await this.prisma.$queryRaw`
      SELECT vrs.id, vrs.title, vrs.location, vrs.rate_text as "rateText",
             vrs.employment_type as "employmentType", vrs.skills, vrs.created_at as "createdAt",
             vc.name as "vendorName"
      FROM vendor_req_signal vrs
      LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
      WHERE vrs.skills && ${consultant.skills || []}::text[]
      ORDER BY vrs.created_at DESC LIMIT 20
    ` as any[];

    return { ...consultant, matchingReqs: relatedReqs };
  }

  async getClients(page = 1, pageSize = 25, search?: string, dateFrom?: string, dateTo?: string) {
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (search) {
      conditions.push(`to_tsvector('english', coalesce(cc.name,'') || ' ' || coalesce(cc.domain,'')) @@ plainto_tsquery('english', $${idx})`);
      params.push(search);
      idx++;
    }
    if (dateFrom) {
      conditions.push(`cc.last_seen >= $${idx}::timestamptz`);
      params.push(dateFrom);
      idx++;
    }
    if (dateTo) {
      conditions.push(`cc.last_seen <= $${idx}::timestamptz`);
      params.push(dateTo);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataParams = [...params, pageSize, offset];

    const clients = await this.prisma.$queryRawUnsafe(`
      SELECT cc.id, cc.domain, cc.name, cc.email_count as "emailCount",
             cc.first_seen as "firstSeen", cc.last_seen as "lastSeen",
             (SELECT COUNT(*)::int FROM client_contact ct WHERE ct.client_company_id = cc.id) as "contactCount"
      FROM client_company cc ${where}
      ORDER BY cc.email_count DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, ...dataParams);

    const totalResult = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM client_company cc ${where}`,
      ...params,
    ) as any[];

    return {
      data: clients,
      pagination: { page, pageSize, total: totalResult[0].total, totalPages: Math.ceil(totalResult[0].total / pageSize) },
    };
  }

  async getClientDetail(id: string) {
    const [company] = await this.prisma.$queryRaw`
      SELECT cc.id, cc.domain, cc.name, cc.email_count as "emailCount",
             cc.first_seen as "firstSeen", cc.last_seen as "lastSeen"
      FROM client_company cc WHERE cc.id = ${id}::uuid
    ` as any[];

    if (!company) return null;

    const contacts = await this.prisma.$queryRaw`
      SELECT ct.id, ct.name, ct.email, ct.email_count as "emailCount",
             ct.first_seen as "firstSeen", ct.last_seen as "lastSeen"
      FROM client_contact ct WHERE ct.client_company_id = ${id}::uuid
      ORDER BY ct.email_count DESC LIMIT 50
    ` as any[];

    return { ...company, contacts };
  }

  async getReqSignals(page = 1, pageSize = 25, empType?: string, search?: string, dateFrom?: string, dateTo?: string) {
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (empType && empType !== 'ALL') {
      conditions.push(`vrs.employment_type = $${idx}`);
      params.push(empType);
      idx++;
    }
    if (search) {
      conditions.push(`to_tsvector('english', coalesce(vrs.title,'') || ' ' || coalesce(vrs.location,'') || ' ' || coalesce(vrs.rate_text,'')) @@ plainto_tsquery('english', $${idx})`);
      params.push(search);
      idx++;
    }
    if (dateFrom) {
      conditions.push(`vrs.created_at >= $${idx}::timestamptz`);
      params.push(dateFrom);
      idx++;
    }
    if (dateTo) {
      conditions.push(`vrs.created_at <= $${idx}::timestamptz`);
      params.push(dateTo);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataParams = [...params, pageSize, offset];

    const signals = await this.prisma.$queryRawUnsafe(`
      SELECT vrs.id, vrs.title, vrs.location, vrs.rate_text as "rateText",
             vrs.employment_type as "employmentType", vrs.skills,
             vrs.created_at as "createdAt",
             vc.domain as "vendorDomain", vc.name as "vendorName", vc.id as "vendorId",
             vct.email as "contactEmail", vct.name as "contactName"
      FROM vendor_req_signal vrs
      LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
      LEFT JOIN vendor_contact vct ON vct.id = vrs.vendor_contact_id
      ${where}
      ORDER BY vrs.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, ...dataParams);

    const totalResult = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM vendor_req_signal vrs ${where}`,
      ...params,
    ) as any[];

    return {
      data: signals,
      pagination: { page, pageSize, total: totalResult[0].total, totalPages: Math.ceil(totalResult[0].total / pageSize) },
    };
  }

  async getSkillsDemand() {
    return this.prisma.$queryRaw`
      SELECT skill as name, COUNT(*)::int as count
      FROM vendor_req_signal, unnest(skills) as skill
      GROUP BY skill ORDER BY count DESC LIMIT 30
    ` as Promise<any[]>;
  }

  async getSkillsSupply() {
    return this.prisma.$queryRaw`
      SELECT skill as name, COUNT(*)::int as count
      FROM consultant, unnest(primary_skills) as skill
      GROUP BY skill ORDER BY count DESC LIMIT 30
    ` as Promise<any[]>;
  }

  /* ═══════ Step 3: Req → Job Pipeline ═══════ */

  async convertReqToJob(reqId: string, tenantId: string) {
    const [req] = await this.prisma.$queryRaw`
      SELECT vrs.*, vc.name as vendor_name, vc.domain as vendor_domain,
             vct.email as contact_email, vct.name as contact_name
      FROM vendor_req_signal vrs
      LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
      LEFT JOIN vendor_contact vct ON vct.id = vrs.vendor_contact_id
      WHERE vrs.id = ${reqId}::uuid
    ` as any[];

    if (!req) return null;

    const job = await this.prisma.job.create({
      data: {
        tenantId,
        title: req.title || 'Untitled Position',
        description: `Extracted from vendor email req signal.\nLocation: ${req.location || 'N/A'}\nRate: ${req.rate_text || 'N/A'}\nEmployment: ${req.employment_type || 'N/A'}\nVendor: ${req.vendor_name || 'Unknown'} (${req.vendor_domain || ''})\nContact: ${req.contact_name || ''} <${req.contact_email || ''}>`,
        status: 'OPEN',
        skills: req.skills || [],
        location: req.location || null,
        employmentType: req.employment_type === 'C2C' ? 'C2C' : req.employment_type === 'W2' ? 'W2' : 'CONTRACT',
        billRate: null,
        payRate: null,
      } as any,
    });

    return job;
  }

  async bulkConvertReqs(filters: { empType?: string; dateFrom?: string; dateTo?: string; limit?: number }, tenantId: string) {
    const conditions: string[] = ["vrs.title IS NOT NULL", "vrs.title != ''"];
    const params: any[] = [];
    let idx = 1;

    if (filters.empType) {
      conditions.push(`vrs.employment_type = $${idx}`);
      params.push(filters.empType);
      idx++;
    }
    if (filters.dateFrom) {
      conditions.push(`vrs.created_at >= $${idx}::timestamptz`);
      params.push(filters.dateFrom);
      idx++;
    }
    if (filters.dateTo) {
      conditions.push(`vrs.created_at <= $${idx}::timestamptz`);
      params.push(filters.dateTo);
      idx++;
    }

    const limit = filters.limit || 100;
    params.push(limit);

    const reqs = await this.prisma.$queryRawUnsafe(`
      SELECT vrs.id, vrs.title, vrs.location, vrs.rate_text, vrs.employment_type,
             vrs.skills, vc.name as vendor_name, vc.domain as vendor_domain,
             vct.email as contact_email, vct.name as contact_name
      FROM vendor_req_signal vrs
      LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
      LEFT JOIN vendor_contact vct ON vct.id = vrs.vendor_contact_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY vrs.created_at DESC
      LIMIT $${idx}
    `, ...params) as any[];

    let converted = 0;
    for (const req of reqs) {
      try {
        await this.prisma.job.create({
          data: {
            tenantId,
            title: req.title,
            description: `Location: ${req.location || 'N/A'}\nRate: ${req.rate_text || 'N/A'}\nVendor: ${req.vendor_name || 'Unknown'}\nContact: ${req.contact_email || 'N/A'}`,
            status: 'OPEN',
            skills: req.skills || [],
            location: req.location || null,
            employmentType: req.employment_type === 'C2C' ? 'C2C' : req.employment_type === 'W2' ? 'W2' : 'CONTRACT',
          } as any,
        });
        converted++;
      } catch {
        // skip duplicates or schema mismatches
      }
    }

    return { converted, total: reqs.length };
  }

  /* ═══════ Step 4: AI Matching ═══════ */

  async matchConsultantsToReq(reqId: string, limit = 10) {
    const [req] = await this.prisma.$queryRaw`
      SELECT skills FROM vendor_req_signal WHERE id = ${reqId}::uuid
    ` as any[];

    if (!req || !req.skills?.length) return [];

    const consultants = await this.prisma.$queryRaw`
      SELECT c.id, c.full_name as "fullName", c.email, c.phone,
             c.primary_skills as "skills", c.last_seen as "lastSeen"
      FROM consultant c
      WHERE c.primary_skills && ${req.skills}::text[]
        AND c.full_name IS NOT NULL AND c.full_name != ''
      ORDER BY c.last_seen DESC NULLS LAST
      LIMIT 200
    ` as any[];

    const reqSkills: string[] = req.skills.map((s: string) => s.toLowerCase());

    const scored = consultants.map((c: any) => {
      const cSkills: string[] = (c.skills || []).map((s: string) => s.toLowerCase());
      const exact = reqSkills.filter(s => cSkills.includes(s));
      const partial = reqSkills.filter(s => !exact.includes(s) && cSkills.some(cs => cs.includes(s) || s.includes(cs)));
      const score = Math.min(100, Math.round(((exact.length * 20 + partial.length * 8) / Math.max(reqSkills.length, 1)) * (100 / 20)));
      return { ...c, matchScore: score, matchingSkills: exact, partialSkills: partial };
    })
    .filter(c => c.matchScore > 0)
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, limit);

    return scored;
  }

  async getReqWithMatches(reqId: string) {
    const [req] = await this.prisma.$queryRaw`
      SELECT vrs.*, vc.name as "vendorName", vc.domain as "vendorDomain",
             vct.email as "contactEmail", vct.name as "contactName"
      FROM vendor_req_signal vrs
      LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
      LEFT JOIN vendor_contact vct ON vct.id = vrs.vendor_contact_id
      WHERE vrs.id = ${reqId}::uuid
    ` as any[];

    if (!req) return null;

    const matches = await this.matchConsultantsToReq(reqId, 10);

    return {
      id: req.id,
      title: req.title,
      location: req.location,
      rateText: req.rate_text,
      employmentType: req.employment_type,
      skills: req.skills,
      createdAt: req.created_at,
      vendorName: req.vendorName,
      vendorDomain: req.vendorDomain,
      contactEmail: req.contactEmail,
      contactName: req.contactName,
      topMatches: matches,
    };
  }

  /* ═══════ Step 6: CSV Exports ═══════ */

  async exportVendorsCsv() {
    const rows = await this.prisma.$queryRaw`
      SELECT vc.domain, vc.name, vc.email_count,
             vc.first_seen, vc.last_seen,
             (SELECT COUNT(*)::int FROM vendor_contact vct WHERE vct.vendor_company_id = vc.id) as contact_count,
             (SELECT COUNT(*)::int FROM vendor_req_signal vr WHERE vr.vendor_company_id = vc.id) as req_count
      FROM vendor_company vc
      WHERE vc.name NOT LIKE '[SYSTEM]%'
      ORDER BY vc.email_count DESC
    ` as any[];
    return toCsv(rows, ['domain', 'name', 'email_count', 'contact_count', 'req_count', 'first_seen', 'last_seen']);
  }

  async exportConsultantsCsv() {
    const rows = await this.prisma.$queryRaw`
      SELECT full_name, email, phone,
             array_to_string(primary_skills, '; ') as skills,
             first_seen, last_seen
      FROM consultant
      WHERE full_name IS NOT NULL AND full_name != ''
      ORDER BY last_seen DESC NULLS LAST
    ` as any[];
    return toCsv(rows, ['full_name', 'email', 'phone', 'skills', 'first_seen', 'last_seen']);
  }

  async exportClientsCsv() {
    const rows = await this.prisma.$queryRaw`
      SELECT cc.name, cc.domain, cc.email_count, cc.first_seen, cc.last_seen,
             (SELECT COUNT(*)::int FROM client_contact ct WHERE ct.client_company_id = cc.id) as contact_count
      FROM client_company cc
      ORDER BY cc.email_count DESC
    ` as any[];
    return toCsv(rows, ['name', 'domain', 'email_count', 'contact_count', 'first_seen', 'last_seen']);
  }

  async exportReqsCsv(empType?: string) {
    const where = empType && empType !== 'ALL' ? `WHERE vrs.employment_type = '${empType.replace(/'/g, "''")}'` : '';
    const rows = await this.prisma.$queryRawUnsafe(`
      SELECT vrs.title, vrs.location, vrs.rate_text, vrs.employment_type,
             array_to_string(vrs.skills, '; ') as skills,
             vrs.created_at,
             vc.name as vendor_name, vc.domain as vendor_domain,
             vct.email as contact_email
      FROM vendor_req_signal vrs
      LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
      LEFT JOIN vendor_contact vct ON vct.id = vrs.vendor_contact_id
      ${where}
      ORDER BY vrs.created_at DESC
      LIMIT 50000
    `) as any[];
    return toCsv(rows, ['title', 'location', 'rate_text', 'employment_type', 'skills', 'vendor_name', 'vendor_domain', 'contact_email', 'created_at']);
  }

  async exportContactsCsv(type: 'vendor' | 'client') {
    if (type === 'vendor') {
      const rows = await this.prisma.$queryRaw`
        SELECT vct.name, vct.email, vct.email_count, vct.first_seen, vct.last_seen,
               vc.name as company, vc.domain
        FROM vendor_contact vct
        JOIN vendor_company vc ON vc.id = vct.vendor_company_id
        ORDER BY vct.email_count DESC
      ` as any[];
      return toCsv(rows, ['name', 'email', 'company', 'domain', 'email_count', 'first_seen', 'last_seen']);
    } else {
      const rows = await this.prisma.$queryRaw`
        SELECT ct.name, ct.email, ct.email_count, ct.first_seen, ct.last_seen,
               cc.name as company, cc.domain
        FROM client_contact ct
        JOIN client_company cc ON cc.id = ct.client_company_id
        ORDER BY ct.email_count DESC
      ` as any[];
      return toCsv(rows, ['name', 'email', 'company', 'domain', 'email_count', 'first_seen', 'last_seen']);
    }
  }

  /* ═══════ Sync Status ═══════ */

  async getSyncStatus() {
    const status = await this.prisma.$queryRaw`
      SELECT email, last_synced_at as "lastSynced"
      FROM mailbox ORDER BY email
    ` as any[];
    return status;
  }
}

function toCsv(rows: any[], columns: string[]): string {
  if (rows.length === 0) return columns.join(',') + '\n';
  const header = columns.join(',');
  const body = rows.map(row =>
    columns.map(col => {
      const val = row[col];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(',')
  ).join('\n');
  return header + '\n' + body;
}
