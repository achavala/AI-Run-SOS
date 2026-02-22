import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PstIntelService {
  constructor(private prisma: PrismaService) {}

  async getOverview() {
    const [
      totalEmails,
      processedEmails,
      totalAttachments,
      vendorCompanies,
      recruiterContacts,
      contactsWithPhone,
      contactsWithLinkedIn,
      consultants,
      consultantsFromSpreadsheets,
      consultantsWithResumes,
      totalResumes,
      reqSignals,
      reqsWithRate,
      evidenceFacts,
    ] = await Promise.all([
      this.prisma.rawEmailMessage.count(),
      this.prisma.rawEmailMessage.count({ where: { processed: true } }),
      this.prisma.rawEmailAttachment.count(),
      this.prisma.extractedVendorCompany.count(),
      this.prisma.extractedVendorContact.count(),
      this.prisma.extractedVendorContact.count({ where: { phone: { not: null } } }),
      this.prisma.extractedVendorContact.count({ where: { linkedIn: { not: null } } }),
      this.prisma.extractedConsultant.count(),
      this.prisma.extractedConsultant.count({ where: { sourceType: 'SPREADSHEET' } }),
      this.prisma.extractedResumeVersion.groupBy({ by: ['consultantId'] }).then((r: any[]) => r.length),
      this.prisma.extractedResumeVersion.count(),
      this.prisma.vendorReqSignal.count(),
      this.prisma.vendorReqSignal.count({ where: { rateText: { not: null } } }),
      this.prisma.extractionFact.count(),
    ]);

    const batches = await this.prisma.rawEmailMessage.groupBy({
      by: ['pstBatch'],
      _count: { _all: true },
    });

    const empTypes = await this.prisma.vendorReqSignal.groupBy({
      by: ['employmentType'],
      _count: { _all: true },
    });

    return {
      totalEmails,
      processedEmails,
      totalAttachments,
      vendorCompanies,
      recruiterContacts,
      contactsWithPhone,
      contactsWithLinkedIn,
      consultants,
      consultantsFromSpreadsheets,
      consultantsFromEmails: consultants - consultantsFromSpreadsheets,
      consultantsWithResumes,
      totalResumes,
      reqSignals,
      reqsWithRate,
      evidenceFacts,
      batches: batches.map(b => ({ name: b.pstBatch, count: b._count._all })),
      employmentTypes: empTypes.map(e => ({ type: e.employmentType ?? 'UNKNOWN', count: e._count._all })),
    };
  }

  async getTopVendors(limit = 50) {
    const vendors = await this.prisma.extractedVendorCompany.findMany({
      orderBy: { emailCount: 'desc' },
      take: limit,
      include: {
        _count: { select: { contacts: true, reqSignals: true } },
      },
    });

    return vendors.map((v) => ({
      id: v.id,
      company: v.name ?? v.domain,
      domain: v.domain,
      emailCount: v.emailCount,
      contactCount: v._count.contacts,
      reqSignalCount: v._count.reqSignals,
      lastSeenAt: v.lastSeenAt,
      firstSeenAt: v.firstSeenAt,
    }));
  }

  async getContacts(filters: {
    search?: string;
    vendorId?: string;
    hasPhone?: boolean;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 25, 100);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (filters.vendorId) where.vendorCompanyId = filters.vendorId;
    if (filters.hasPhone) where.phone = { not: null };
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [raw, total] = await Promise.all([
      this.prisma.extractedVendorContact.findMany({
        where,
        orderBy: { emailCount: 'desc' },
        skip,
        take: pageSize,
        include: {
          vendorCompany: { select: { name: true, domain: true } },
        },
      }),
      this.prisma.extractedVendorContact.count({ where }),
    ]);

    const contacts = raw.map((c) => ({
      id: c.id,
      name: c.name,
      email: c.email,
      company: c.vendorCompany?.name ?? c.vendorCompany?.domain ?? null,
      phone: c.phone,
      linkedIn: c.linkedIn,
      emailCount: c.emailCount,
      lastSeenAt: c.lastSeenAt?.toISOString() ?? null,
    }));

    return { contacts, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async getConsultants(filters: {
    search?: string;
    skill?: string;
    sourceType?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 25, 100);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (filters.search) {
      where.OR = [
        { fullName: { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
        { phone: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.skill) {
      where.primarySkills = { has: filters.skill };
    }
    if (filters.sourceType && filters.sourceType !== 'ALL') {
      where.sourceType = filters.sourceType;
    }
    // Hide placeholder emails from results
    if (!filters.search) {
      where.NOT = { email: { contains: 'placeholder.local' } };
    }

    const [raw, total] = await Promise.all([
      this.prisma.extractedConsultant.findMany({
        where,
        orderBy: { lastSeenAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          _count: { select: { resumeVersions: true } },
        },
      }),
      this.prisma.extractedConsultant.count({ where }),
    ]);

    const consultants = raw.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      location: c.location,
      skills: c.primarySkills,
      resumeCount: c._count.resumeVersions,
      sourceType: c.sourceType,
      lastSeenAt: c.lastSeenAt,
    }));

    return { consultants, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async getConsultantDetail(id: string) {
    const c = await this.prisma.extractedConsultant.findUnique({
      where: { id },
      include: {
        resumeVersions: {
          select: { id: true, filename: true, sha256: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!c) return null;
    return {
      id: c.id,
      fullName: c.fullName,
      email: c.email,
      phone: c.phone,
      location: c.location,
      skills: c.primarySkills,
      resumeCount: c.resumeVersions.length,
      sourceType: c.sourceType,
      lastSeenAt: c.lastSeenAt,
      resumes: c.resumeVersions.map((r) => ({ filename: r.filename, date: r.createdAt.toISOString() })),
    };
  }

  async getReqSignals(filters: {
    search?: string;
    employmentType?: string;
    vendorId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const page = filters.page ?? 1;
    const pageSize = Math.min(filters.pageSize ?? 25, 100);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (filters.employmentType && filters.employmentType !== 'ALL') {
      where.employmentType = filters.employmentType;
    }
    if (filters.vendorId) where.vendorCompanyId = filters.vendorId;
    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { location: { contains: filters.search, mode: 'insensitive' } },
        { rateText: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const [raw, total] = await Promise.all([
      this.prisma.vendorReqSignal.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          vendorCompany: { select: { name: true, domain: true } },
          vendorContact: { select: { name: true, email: true, phone: true } },
        },
      }),
      this.prisma.vendorReqSignal.count({ where }),
    ]);

    const signals = raw.map((s) => ({
      id: s.id,
      title: s.title,
      company: s.vendorCompany?.name ?? s.vendorCompany?.domain ?? null,
      contactName: s.vendorContact?.name ?? null,
      contactEmail: s.vendorContact?.email ?? null,
      employmentType: s.employmentType,
      rate: s.rateText,
      skills: (s.skills as string[]) ?? [],
      location: s.location,
    }));

    return { signals, pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async getSkillsDistribution() {
    const allConsultants = await this.prisma.extractedConsultant.findMany({
      select: { primarySkills: true },
    });

    const skillCounts: Record<string, number> = {};
    for (const c of allConsultants) {
      for (const skill of c.primarySkills) {
        const s = skill.toLowerCase();
        skillCounts[s] = (skillCounts[s] ?? 0) + 1;
      }
    }

    return Object.entries(skillCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 50)
      .map(([skill, count]) => ({ name: skill, count }));
  }
}
