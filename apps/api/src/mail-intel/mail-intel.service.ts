import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const FREE_DOMAINS = new Set([
  'gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'aol.com',
  'icloud.com', 'mail.com', 'protonmail.com', 'zoho.com', 'ymail.com',
  'live.com', 'msn.com', 'comcast.net', 'att.net', 'verizon.net',
  'cox.net', 'sbcglobal.net', 'earthlink.net', 'emonics.com',
  'cloudresources.net', 'linkedin.com', 'noreply.com',
  'notifications-noreply@linkedin.com',
]);

const OWN_DOMAINS = new Set(['cloudresources.net', 'emonics.com']);

const REQ_SUBJECT_KEYWORDS = ['req', 'requirement', 'position', 'job', 'opening', 'urgent', 'hot', 'immediate', 'need', 'looking for', 'role', 'hiring', 'c2c', 'w2', 'corp to corp'];
const RATE_PATTERN = /\$\d+([-–]\d+)?\s*\/\s*hr|C2C|W2/i;
const LOCATION_PATTERN = /(?:Location|City|State)\s*[:=]\s*([^\n\r]+)/i;
const RATE_LABEL_PATTERN = /(?:Rate|Bill Rate|Pay Rate)\s*[:=]\s*([^\n\r]+)/i;
const RATE_VALUE_PATTERN = /\$[\d,]+([-–][\d,]+)?\s*(?:\/|\s)(?:hr|hour|hourly)/gi;
const CLIENT_PATTERN = /(?:Client|End Client)\s*[:=]\s*([^\n\r]+)/i;
const EMPLOYMENT_PATTERNS = [
  /\bC2C\b/i, /\bW2\b/i, /\b1099\b/, /\bcontract\s*to\s*hire\b/i,
  /\bc2h\b/i, /\bcontract\b/i, /\bfull[- ]?time\b/i, /\bCorp\s+to\s+Corp\b/i,
];
const TECH_SKILLS = [
  'Java', 'Python', 'AWS', 'Azure', 'React', 'Angular', 'Node', '.NET', 'C#',
  'SQL', 'Snowflake', 'Databricks', 'Kubernetes', 'Docker', 'Terraform', 'DevOps',
  'JavaScript', 'TypeScript', 'Go', 'Scala', 'Ruby', 'PHP', 'Swift', 'Kotlin',
  'MongoDB', 'PostgreSQL', 'Redis', 'Elasticsearch', 'Kafka', 'Spark', 'Hadoop',
  'Machine Learning', 'Tableau', 'Power BI', 'Jenkins', 'Git', 'CI/CD', 'REST API',
  'GraphQL', 'Microservices', 'Spring Boot', 'Django', 'Flask', 'FastAPI', 'Express',
  'Vue', 'Svelte', 'Redux', 'NoSQL', 'Linux', 'Ansible', 'Prometheus', 'Grafana',
  'AI', 'ML', 'GenAI', 'LLM', 'NLP', 'Data Engineering', 'MLOps', 'Cybersecurity',
];

@Injectable()
export class MailIntelService {
  private readonly logger = new Logger(MailIntelService.name);
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
               COUNT(DISTINCT "fromEmail")::int as "uniqueSenders",
               MIN("sentAt") as "oldestEmail",
               MAX("sentAt") as "newestEmail"
        FROM "RawEmailMessage"
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT "pstBatch" as category, COUNT(*)::int as count
        FROM "RawEmailMessage" WHERE "pstBatch" IS NOT NULL
        GROUP BY "pstBatch" ORDER BY count DESC
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT "fromEmail" as email, COUNT(*)::int as count,
               MIN("sentAt") as "oldestEmail", MAX("sentAt") as "newestEmail"
        FROM "RawEmailMessage" GROUP BY "fromEmail" ORDER BY count DESC LIMIT 20
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT
          (SELECT COUNT(*)::int FROM "ExtractedVendorCompany" WHERE name NOT LIKE '[SYSTEM]%') as "vendorCompanies",
          (SELECT COUNT(*)::int FROM "ExtractedVendorContact") as "vendorContacts",
          (SELECT COUNT(*)::int FROM "ClientCompany") as "clientCompanies",
          0 as "clientContacts",
          (SELECT COUNT(*)::int FROM "Consultant") as "consultants",
          (SELECT COUNT(*)::int FROM "VendorReqSignal") as "reqSignals"
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT "employmentType" as type, COUNT(*)::int as count
        FROM "VendorReqSignal" WHERE "employmentType" IS NOT NULL
        GROUP BY "employmentType" ORDER BY count DESC
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT vrs.id, vrs.title, vrs.location, vrs."rateText",
               vrs."employmentType", vrs.skills,
               vrs."createdAt",
               vc.domain as "vendorDomain", vc.name as "vendorName",
               vct.email as "contactEmail"
        FROM "VendorReqSignal" vrs
        LEFT JOIN "ExtractedVendorCompany" vc ON vc.id = vrs."vendorCompanyId"
        LEFT JOIN "ExtractedVendorContact" vct ON vct.id = vrs."vendorContactId"
        ORDER BY vrs."createdAt" DESC LIMIT 20
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
      conditions.push(`vc."lastSeenAt" >= $${idx}::timestamptz`);
      params.push(dateFrom);
      idx++;
    }
    if (dateTo) {
      conditions.push(`vc."lastSeenAt" <= $${idx}::timestamptz`);
      params.push(dateTo);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const dataParams = [...params, pageSize, offset];
    const vendors = await this.prisma.$queryRawUnsafe(`
      SELECT vc.id, vc.domain, vc.name, vc."emailCount",
             vc."firstSeenAt" as "firstSeen", vc."lastSeenAt" as "lastSeen",
             (SELECT COUNT(*)::int FROM "ExtractedVendorContact" vct WHERE vct."vendorCompanyId" = vc.id) as "contactCount",
             (SELECT COUNT(*)::int FROM "VendorReqSignal" vr WHERE vr."vendorCompanyId" = vc.id) as "reqCount"
      FROM "ExtractedVendorCompany" vc ${where}
      ORDER BY vc."emailCount" DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, ...dataParams);

    const totalResult = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM "ExtractedVendorCompany" vc ${where}`,
      ...params,
    ) as any[];

    return {
      data: vendors,
      pagination: { page, pageSize, total: totalResult[0].total, totalPages: Math.ceil(totalResult[0].total / pageSize) },
    };
  }

  async getVendorDetail(id: string) {
    const [company] = await this.prisma.$queryRaw`
      SELECT vc.id, vc.domain, vc.name, vc."emailCount",
             vc."firstSeenAt" as "firstSeen", vc."lastSeenAt" as "lastSeen"
      FROM "ExtractedVendorCompany" vc WHERE vc.id = ${id}::uuid
    ` as any[];

    if (!company) return null;

    const [contacts, recentReqs, topSkills] = await Promise.all([
      this.prisma.$queryRaw`
        SELECT vct.id, vct.name, vct.email, vct."emailCount",
               vct."firstSeenAt" as "firstSeen", vct."lastSeenAt" as "lastSeen"
        FROM "ExtractedVendorContact" vct WHERE vct."vendorCompanyId" = ${id}::uuid
        ORDER BY vct."emailCount" DESC LIMIT 50
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT vrs.id, vrs.title, vrs.location, vrs."rateText",
               vrs."employmentType", vrs.skills,
               vrs."createdAt",
               vct.email as "contactEmail", vct.name as "contactName"
        FROM "VendorReqSignal" vrs
        LEFT JOIN "ExtractedVendorContact" vct ON vct.id = vrs."vendorContactId"
        WHERE vrs."vendorCompanyId" = ${id}::uuid
        ORDER BY vrs."createdAt" DESC LIMIT 50
      ` as Promise<any[]>,

      this.prisma.$queryRaw`
        SELECT skill as name, COUNT(*)::int as count
        FROM "VendorReqSignal" vrs, unnest(vrs.skills) as skill
        WHERE vrs."vendorCompanyId" = ${id}::uuid
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
      conditions.push(`vct."vendorCompanyId" = $${idx}::uuid`);
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
      SELECT vct.id, vct.name, vct.email, vct."emailCount",
             vct."firstSeenAt" as "firstSeen", vct."lastSeenAt" as "lastSeen",
             vc.domain as "vendorDomain", vc.name as "vendorName"
      FROM "ExtractedVendorContact" vct
      JOIN "ExtractedVendorCompany" vc ON vc.id = vct."vendorCompanyId"
      ${where}
      ORDER BY vct."emailCount" DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, ...dataParams);

    const totalResult = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM "ExtractedVendorContact" vct ${where}`,
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
      conditions.push(`(to_tsvector('english', coalesce(c."firstName" || ' ' || c."lastName",'') || ' ' || coalesce(c.email,'') || ' ' || coalesce(c.phone,'')) @@ plainto_tsquery('english', $${idx}) OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(c.skills) el WHERE el = $${idx}))`);
      params.push(search);
      idx++;
    }
    if (dateFrom) {
      conditions.push(`c."updatedAt" >= $${idx}::timestamptz`);
      params.push(dateFrom);
      idx++;
    }
    if (dateTo) {
      conditions.push(`c."updatedAt" <= $${idx}::timestamptz`);
      params.push(dateTo);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataParams = [...params, pageSize, offset];

    const consultants = await this.prisma.$queryRawUnsafe(`
      SELECT c.id, c."firstName" || ' ' || c."lastName" as "fullName", c.email, c.phone,
             c.skills as "skills",
             c."createdAt" as "firstSeen", c."updatedAt" as "lastSeen"
      FROM "Consultant" c ${where}
      ORDER BY c."updatedAt" DESC NULLS LAST
      LIMIT $${idx} OFFSET $${idx + 1}
    `, ...dataParams);

    const totalResult = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM "Consultant" c ${where}`,
      ...params,
    ) as any[];

    return {
      data: consultants,
      pagination: { page, pageSize, total: totalResult[0].total, totalPages: Math.ceil(totalResult[0].total / pageSize) },
    };
  }

  async getConsultantDetail(id: string) {
    const [consultant] = await this.prisma.$queryRaw`
      SELECT c.id, c."firstName" || ' ' || c."lastName" as "fullName", c.email, c.phone,
             c.skills as "skills",
             c."createdAt" as "firstSeen", c."updatedAt" as "lastSeen"
      FROM "Consultant" c WHERE c.id = ${id}::uuid
    ` as any[];

    if (!consultant) return null;

    const skillsArr: string[] = Array.isArray(consultant.skills) ? consultant.skills : [];

    let relatedReqs: any[] = [];
    if (skillsArr.length > 0) {
      relatedReqs = await this.prisma.$queryRaw`
        SELECT vrs.id, vrs.title, vrs.location, vrs."rateText",
               vrs."employmentType", vrs.skills, vrs."createdAt",
               vc.name as "vendorName"
        FROM "VendorReqSignal" vrs
        LEFT JOIN "ExtractedVendorCompany" vc ON vc.id = vrs."vendorCompanyId"
        WHERE vrs.skills && ${skillsArr}::text[]
        ORDER BY vrs."createdAt" DESC LIMIT 20
      ` as any[];
    }

    return { ...consultant, matchingReqs: relatedReqs };
  }

  async getClients(page = 1, pageSize = 25, search?: string, _dateFrom?: string, _dateTo?: string) {
    try {
      const offset = (page - 1) * pageSize;
      const conditions: string[] = [];
      const params: any[] = [];
      let idx = 1;

      if (search) {
        conditions.push(`to_tsvector('english', coalesce(cc.name,'') || ' ' || coalesce(cc.website,'')) @@ plainto_tsquery('english', $${idx})`);
        params.push(search);
        idx++;
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const dataParams = [...params, pageSize, offset];

      const clients = await this.prisma.$queryRawUnsafe(`
        SELECT cc.id, cc.website as domain, cc.name,
               0 as "emailCount",
               cc."createdAt" as "firstSeen", cc."updatedAt" as "lastSeen",
               0 as "contactCount"
        FROM "ClientCompany" cc ${where}
        ORDER BY cc."updatedAt" DESC
        LIMIT $${idx} OFFSET $${idx + 1}
      `, ...dataParams);

      const totalResult = await this.prisma.$queryRawUnsafe(
        `SELECT COUNT(*)::int as total FROM "ClientCompany" cc ${where}`,
        ...params,
      ) as any[];

      return {
        data: clients,
        pagination: { page, pageSize, total: totalResult[0]?.total || 0, totalPages: Math.ceil((totalResult[0]?.total || 0) / pageSize) },
      };
    } catch {
      return { data: [], pagination: { page, pageSize, total: 0, totalPages: 0 } };
    }
  }

  async getClientDetail(id: string) {
    try {
      const [company] = await this.prisma.$queryRaw`
        SELECT cc.id, cc.website as domain, cc.name,
               0 as "emailCount",
               cc."createdAt" as "firstSeen", cc."updatedAt" as "lastSeen"
        FROM "ClientCompany" cc WHERE cc.id = ${id}
      ` as any[];

      if (!company) return null;
      return { ...company, contacts: [] };
    } catch {
      return null;
    }
  }

  async getReqSignals(page = 1, pageSize = 25, empType?: string, search?: string, dateFrom?: string, dateTo?: string) {
    const offset = (page - 1) * pageSize;
    const conditions: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (empType && empType !== 'ALL') {
      conditions.push(`vrs."employmentType" = $${idx}`);
      params.push(empType);
      idx++;
    }
    if (search) {
      conditions.push(`to_tsvector('english', coalesce(vrs.title,'') || ' ' || coalesce(vrs.location,'') || ' ' || coalesce(vrs."rateText",'')) @@ plainto_tsquery('english', $${idx})`);
      params.push(search);
      idx++;
    }
    if (dateFrom) {
      conditions.push(`vrs."createdAt" >= $${idx}::timestamptz`);
      params.push(dateFrom);
      idx++;
    }
    if (dateTo) {
      conditions.push(`vrs."createdAt" <= $${idx}::timestamptz`);
      params.push(dateTo);
      idx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const dataParams = [...params, pageSize, offset];

    const signals = await this.prisma.$queryRawUnsafe(`
      SELECT vrs.id, vrs.title, vrs.location, vrs."rateText",
             vrs."employmentType", vrs.skills,
             vrs."createdAt",
             vc.domain as "vendorDomain", vc.name as "vendorName", vc.id as "vendorId",
             vct.email as "contactEmail", vct.name as "contactName"
      FROM "VendorReqSignal" vrs
      LEFT JOIN "ExtractedVendorCompany" vc ON vc.id = vrs."vendorCompanyId"
      LEFT JOIN "ExtractedVendorContact" vct ON vct.id = vrs."vendorContactId"
      ${where}
      ORDER BY vrs."createdAt" DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, ...dataParams);

    const totalResult = await this.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int as total FROM "VendorReqSignal" vrs ${where}`,
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
      FROM "VendorReqSignal", unnest(skills) as skill
      GROUP BY skill ORDER BY count DESC LIMIT 30
    ` as Promise<any[]>;
  }

  async getSkillsSupply() {
    return this.prisma.$queryRaw`
      SELECT skill as name, COUNT(*)::int as count
      FROM "Consultant", jsonb_array_elements_text(skills) as skill
      GROUP BY skill ORDER BY count DESC LIMIT 30
    ` as Promise<any[]>;
  }

  /* ═══════ Step 3: Req → Job Pipeline ═══════ */

  async convertReqToJob(reqId: string, tenantId: string) {
    const [req] = await this.prisma.$queryRaw`
      SELECT vrs.*, vc.name as vendor_name, vc.domain as vendor_domain,
             vct.email as contact_email, vct.name as contact_name
      FROM "VendorReqSignal" vrs
      LEFT JOIN "ExtractedVendorCompany" vc ON vc.id = vrs."vendorCompanyId"
      LEFT JOIN "ExtractedVendorContact" vct ON vct.id = vrs."vendorContactId"
      WHERE vrs.id = ${reqId}::uuid
    ` as any[];

    if (!req) return null;

    const job = await this.prisma.job.create({
      data: {
        tenantId,
        title: req.title || 'Untitled Position',
        description: `Extracted from vendor email req signal.\nLocation: ${req.location || 'N/A'}\nRate: ${req.rateText || req.rate_text || 'N/A'}\nEmployment: ${req.employmentType || req.employment_type || 'N/A'}\nVendor: ${req.vendor_name || 'Unknown'} (${req.vendor_domain || ''})\nContact: ${req.contact_name || ''} <${req.contact_email || ''}>`,
        status: 'OPEN',
        skills: req.skills || [],
        location: req.location || null,
        employmentType: (req.employmentType || req.employment_type) === 'C2C' ? 'C2C' : (req.employmentType || req.employment_type) === 'W2' ? 'W2' : 'CONTRACT',
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
      conditions.push(`vrs."employmentType" = $${idx}`);
      params.push(filters.empType);
      idx++;
    }
    if (filters.dateFrom) {
      conditions.push(`vrs."createdAt" >= $${idx}::timestamptz`);
      params.push(filters.dateFrom);
      idx++;
    }
    if (filters.dateTo) {
      conditions.push(`vrs."createdAt" <= $${idx}::timestamptz`);
      params.push(filters.dateTo);
      idx++;
    }

    const limit = filters.limit || 100;
    params.push(limit);

    const reqs = await this.prisma.$queryRawUnsafe(`
      SELECT vrs.id, vrs.title, vrs.location, vrs."rateText", vrs."employmentType",
             vrs.skills, vc.name as vendor_name, vc.domain as vendor_domain,
             vct.email as contact_email, vct.name as contact_name
      FROM "VendorReqSignal" vrs
      LEFT JOIN "ExtractedVendorCompany" vc ON vc.id = vrs."vendorCompanyId"
      LEFT JOIN "ExtractedVendorContact" vct ON vct.id = vrs."vendorContactId"
      WHERE ${conditions.join(' AND ')}
      ORDER BY vrs."createdAt" DESC
      LIMIT $${idx}
    `, ...params) as any[];

    let converted = 0;
    for (const req of reqs) {
      try {
        await this.prisma.job.create({
          data: {
            tenantId,
            title: req.title,
            description: `Location: ${req.location || 'N/A'}\nRate: ${req.rateText || 'N/A'}\nVendor: ${req.vendor_name || 'Unknown'}\nContact: ${req.contact_email || 'N/A'}`,
            status: 'OPEN',
            skills: req.skills || [],
            location: req.location || null,
            employmentType: req.employmentType === 'C2C' ? 'C2C' : req.employmentType === 'W2' ? 'W2' : 'CONTRACT',
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
      SELECT skills FROM "VendorReqSignal" WHERE id = ${reqId}::uuid
    ` as any[];

    if (!req || !req.skills?.length) return [];

    const consultants = await this.prisma.$queryRaw`
      SELECT c.id, c."firstName" || ' ' || c."lastName" as "fullName", c.email, c.phone,
             c.skills as "skills", c."updatedAt" as "lastSeen"
      FROM "Consultant" c
      WHERE EXISTS (SELECT 1 FROM jsonb_array_elements_text(c.skills) el WHERE el = ANY(${req.skills}::text[]))
        AND c."firstName" IS NOT NULL AND c."firstName" != ''
      ORDER BY c."updatedAt" DESC NULLS LAST
      LIMIT 200
    ` as any[];

    const reqSkills: string[] = req.skills.map((s: string) => s.toLowerCase());

    const scored = consultants.map((c: any) => {
      const cSkills: string[] = (Array.isArray(c.skills) ? c.skills : []).map((s: string) => s.toLowerCase());
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
      FROM "VendorReqSignal" vrs
      LEFT JOIN "ExtractedVendorCompany" vc ON vc.id = vrs."vendorCompanyId"
      LEFT JOIN "ExtractedVendorContact" vct ON vct.id = vrs."vendorContactId"
      WHERE vrs.id = ${reqId}::uuid
    ` as any[];

    if (!req) return null;

    const matches = await this.matchConsultantsToReq(reqId, 10);

    return {
      id: req.id,
      title: req.title,
      location: req.location,
      rateText: req.rateText || req.rate_text,
      employmentType: req.employmentType || req.employment_type,
      skills: req.skills,
      createdAt: req.createdAt || req.created_at,
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
      SELECT vc.domain, vc.name, vc."emailCount" as email_count,
             vc."firstSeenAt" as first_seen, vc."lastSeenAt" as last_seen,
             (SELECT COUNT(*)::int FROM "ExtractedVendorContact" vct WHERE vct."vendorCompanyId" = vc.id) as contact_count,
             (SELECT COUNT(*)::int FROM "VendorReqSignal" vr WHERE vr."vendorCompanyId" = vc.id) as req_count
      FROM "ExtractedVendorCompany" vc
      WHERE vc.name NOT LIKE '[SYSTEM]%'
      ORDER BY vc."emailCount" DESC
    ` as any[];
    return toCsv(rows, ['domain', 'name', 'email_count', 'contact_count', 'req_count', 'first_seen', 'last_seen']);
  }

  async exportConsultantsCsv() {
    const rows = await this.prisma.$queryRaw`
      SELECT "firstName" || ' ' || "lastName" as full_name, email, phone,
             (SELECT string_agg(el, '; ') FROM jsonb_array_elements_text(skills) el) as skills,
             "createdAt" as first_seen, "updatedAt" as last_seen
      FROM "Consultant"
      WHERE "firstName" IS NOT NULL AND "firstName" != ''
      ORDER BY "updatedAt" DESC NULLS LAST
    ` as any[];
    return toCsv(rows, ['full_name', 'email', 'phone', 'skills', 'first_seen', 'last_seen']);
  }

  async exportClientsCsv() {
    try {
      const rows = await this.prisma.$queryRaw`
        SELECT cc.name, cc.website as domain, 0 as email_count, 0 as contact_count,
               cc."createdAt" as first_seen, cc."updatedAt" as last_seen
        FROM "ClientCompany" cc
        ORDER BY cc."updatedAt" DESC
      ` as any[];
      return toCsv(rows, ['name', 'domain', 'email_count', 'contact_count', 'first_seen', 'last_seen']);
    } catch {
      return toCsv([], ['name', 'domain', 'email_count', 'contact_count', 'first_seen', 'last_seen']);
    }
  }

  async exportReqsCsv(empType?: string) {
    const where = empType && empType !== 'ALL' ? `WHERE vrs."employmentType" = '${empType.replace(/'/g, "''")}'` : '';
    const rows = await this.prisma.$queryRawUnsafe(`
      SELECT vrs.title, vrs.location, vrs."rateText" as rate_text, vrs."employmentType" as employment_type,
             array_to_string(vrs.skills, '; ') as skills,
             vrs."createdAt" as created_at,
             vc.name as vendor_name, vc.domain as vendor_domain,
             vct.email as contact_email
      FROM "VendorReqSignal" vrs
      LEFT JOIN "ExtractedVendorCompany" vc ON vc.id = vrs."vendorCompanyId"
      LEFT JOIN "ExtractedVendorContact" vct ON vct.id = vrs."vendorContactId"
      ${where}
      ORDER BY vrs."createdAt" DESC
      LIMIT 50000
    `) as any[];
    return toCsv(rows, ['title', 'location', 'rate_text', 'employment_type', 'skills', 'vendor_name', 'vendor_domain', 'contact_email', 'created_at']);
  }

  async exportContactsCsv(type: 'vendor' | 'client') {
    if (type === 'vendor') {
      const rows = await this.prisma.$queryRaw`
        SELECT vct.name, vct.email, vct."emailCount" as email_count,
               vct."firstSeenAt" as first_seen, vct."lastSeenAt" as last_seen,
               vc.name as company, vc.domain
        FROM "ExtractedVendorContact" vct
        JOIN "ExtractedVendorCompany" vc ON vc.id = vct."vendorCompanyId"
        ORDER BY vct."emailCount" DESC
      ` as any[];
      return toCsv(rows, ['name', 'email', 'company', 'domain', 'email_count', 'first_seen', 'last_seen']);
    } else {
      return toCsv([], ['name', 'email', 'company', 'domain', 'email_count', 'first_seen', 'last_seen']);
    }
  }

  /* ═══════ Sync Status ═══════ */

  async getSyncStatus() {
    try {
      const status = await this.prisma.$queryRaw`
        SELECT email, last_synced_at as "lastSynced"
        FROM mailbox ORDER BY email
      ` as any[];
      return status;
    } catch {
      return [];
    }
  }

  async getMailboxes() {
    try {
      const mailboxes = await this.prisma.$queryRaw`
        SELECT m.email,
          m.last_synced_at as "lastSynced",
          (SELECT COUNT(*)::int FROM "RawEmailMessage" WHERE "fromEmail" = m.email) as "emailCount"
        FROM mailbox m ORDER BY email
      ` as any[];
      return mailboxes;
    } catch {
      return [];
    }
  }

  async addMailbox(email: string) {
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email address');
    }
    try {
      const existing = await this.prisma.$queryRaw`
        SELECT id FROM mailbox WHERE email = ${email}
      ` as any[];
      if (existing.length > 0) {
        return { message: 'Mailbox already registered', email };
      }
      await this.prisma.$executeRaw`
        INSERT INTO mailbox (id, email) VALUES (gen_random_uuid(), ${email})
      `;
      return { message: 'Mailbox added successfully. It will sync on the next daemon cycle.', email };
    } catch {
      return { message: 'Mailbox table not available', email };
    }
  }

  async reExtractSignals(): Promise<{ vendorsCreated: number; contactsCreated: number; signalsCreated: number; emailsScanned: number }> {
    this.logger.log('Starting re-extraction from RawEmailMessage...');
    let vendorsCreated = 0;
    let contactsCreated = 0;
    let signalsCreated = 0;
    let emailsScanned = 0;

    const BATCH_SIZE = 500;
    let cursor: string | undefined;

    while (true) {
      const emails = await this.prisma.rawEmailMessage.findMany({
        where: { fromEmail: { not: null } },
        take: BATCH_SIZE,
        orderBy: { id: 'asc' },
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        select: { id: true, fromEmail: true, fromName: true, subject: true, bodyText: true, bodyHtml: true, sentAt: true },
      });

      if (emails.length === 0) break;

      for (const email of emails) {
        try {
          const fromEmail = email.fromEmail?.trim().toLowerCase();
          if (!fromEmail) continue;

          const domain = fromEmail.includes('@') ? fromEmail.split('@')[1] : null;
          if (!domain || FREE_DOMAINS.has(domain) || OWN_DOMAINS.has(domain)) continue;

          // Upsert vendor company
          const existingCompany = await this.prisma.extractedVendorCompany.findUnique({ where: { domain } });
          let companyId: string;
          if (existingCompany) {
            companyId = existingCompany.id;
          } else {
            const company = await this.prisma.extractedVendorCompany.create({
              data: { domain: domain!, name: (domain!.split('.')[0] ?? '').charAt(0).toUpperCase() + (domain!.split('.')[0] ?? '').slice(1), emailCount: 1 },
            });
            companyId = company.id;
            vendorsCreated++;
          }

          // Upsert vendor contact
          const existingContact = await this.prisma.extractedVendorContact.findUnique({ where: { email: fromEmail } });
          if (!existingContact) {
            await this.prisma.extractedVendorContact.create({
              data: { vendorCompanyId: companyId, email: fromEmail, name: email.fromName || null, emailCount: 1 },
            });
            contactsCreated++;
          }

          // Check if signal already exists for this email
          const existingSignal = await this.prisma.vendorReqSignal.findFirst({ where: { rawEmailId: email.id } });
          if (existingSignal) continue;

          // Check if it looks like a job req
          const subject = email.subject ?? '';
          const body = (email.bodyText ?? email.bodyHtml ?? '').replace(/<[^>]+>/g, ' ');
          const bodyPrefix = body.slice(0, 500);
          const subj = subject.toLowerCase();

          const hasKeyword = REQ_SUBJECT_KEYWORDS.some(kw => subj.includes(kw));
          const hasRate = RATE_PATTERN.test(bodyPrefix);
          if (!hasKeyword && !hasRate) continue;

          const title = subject.replace(/^(RE:\s*|FW:\s*|Fwd:\s*)+/i, '').trim() || null;
          if (!title || title.length < 5) continue;

          const locationMatch = body.match(LOCATION_PATTERN);
          const location = locationMatch?.[1]?.trim() || null;

          let employmentType: string | null = null;
          for (const re of EMPLOYMENT_PATTERNS) {
            const m = body.match(re);
            if (m) {
              const s = m[0];
              if (/\bC2C\b/i.test(s) || /Corp\s+to\s+Corp/i.test(s)) { employmentType = 'C2C'; break; }
              if (/\bW2\b/i.test(s)) { employmentType = 'W2'; break; }
              if (/\b1099\b/.test(s)) { employmentType = '1099'; break; }
              if (/contract\s*to\s*hire/i.test(s) || /c2h/i.test(s)) { employmentType = 'C2H'; break; }
              if (/contract/i.test(s)) { employmentType = 'CONTRACT'; break; }
              if (/full[- ]?time/i.test(s)) { employmentType = 'FTE'; break; }
            }
          }

          const rateLabel = body.match(RATE_LABEL_PATTERN);
          const rateVal = body.match(RATE_VALUE_PATTERN);
          const rateText = rateLabel?.[1]?.trim() || rateVal?.[0]?.trim() || null;

          const skills: string[] = [];
          const lower = (subject + '\n' + body).toLowerCase();
          for (const skill of TECH_SKILLS) {
            const re = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
            if (re.test(lower)) skills.push(skill);
          }

          const clientMatch = body.match(CLIENT_PATTERN);
          const clientHint = clientMatch?.[1]?.trim() || null;

          const contact = await this.prisma.extractedVendorContact.findUnique({ where: { email: fromEmail } });
          const company = domain ? await this.prisma.extractedVendorCompany.findUnique({ where: { domain } }) : null;

          await this.prisma.vendorReqSignal.create({
            data: {
              vendorCompanyId: company?.id ?? null,
              vendorContactId: contact?.id ?? null,
              rawEmailId: email.id,
              title,
              location,
              employmentType,
              rateText,
              skills,
              clientHint,
            },
          });
          signalsCreated++;
        } catch (err) {
          // Skip individual email errors
        }
      }

      emailsScanned += emails.length;
      cursor = emails[emails.length - 1]!.id;

      if (emailsScanned % 5000 === 0) {
        this.logger.log(`Scanned ${emailsScanned} emails, signals: ${signalsCreated}, vendors: ${vendorsCreated}`);
      }
    }

    this.logger.log(`Re-extraction complete: ${emailsScanned} emails scanned, ${signalsCreated} new signals, ${vendorsCreated} new vendors, ${contactsCreated} new contacts`);
    return { vendorsCreated, contactsCreated, signalsCreated, emailsScanned };
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
