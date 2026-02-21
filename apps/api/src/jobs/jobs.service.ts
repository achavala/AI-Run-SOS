import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JobsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const jobs = await this.prisma.job.findMany({
      where: { tenantId },
      include: {
        vendor: { select: { companyName: true } },
        _count: { select: { submissions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return jobs.map((j) => ({
      id: j.id,
      title: j.title,
      vendorName: j.vendor.companyName,
      skills: j.skills as string[],
      location: j.location,
      locationType: j.locationType,
      rateMin: j.rateMin,
      rateMax: j.rateMax,
      status: j.status,
      closureLikelihood: j.closureLikelihood,
      submissionCount: j._count.submissions,
      createdAt: j.createdAt.toISOString(),
    }));
  }

  async findOne(tenantId: string, id: string) {
    const job = await this.prisma.job.findFirst({
      where: { id, tenantId },
      include: {
        vendor: true,
        submissions: {
          take: 50,
          orderBy: { createdAt: 'desc' },
          include: {
            consultant: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  async create(
    tenantId: string,
    data: {
      vendorId: string;
      title: string;
      description: string;
      skills?: string[];
      location?: string;
      locationType?: string;
      rateMin?: number;
      rateMax?: number;
      rateType?: string;
      startDate?: string;
      durationMonths?: number;
    },
  ) {
    return this.prisma.job.create({
      data: {
        tenantId,
        vendorId: data.vendorId,
        title: data.title,
        description: data.description,
        skills: data.skills ?? [],
        location: data.location,
        locationType: (data.locationType as any) ?? 'REMOTE',
        rateMin: data.rateMin,
        rateMax: data.rateMax,
        rateType: (data.rateType as any) ?? 'HOURLY',
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        durationMonths: data.durationMonths,
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      title?: string;
      description?: string;
      skills?: string[];
      location?: string;
      locationType?: string;
      rateMin?: number;
      rateMax?: number;
      rateType?: string;
      startDate?: string;
      durationMonths?: number;
      status?: string;
    },
  ) {
    await this.ensureExists(tenantId, id);

    const updateData: any = { ...data };
    if (data.startDate) updateData.startDate = new Date(data.startDate);

    return this.prisma.job.update({ where: { id }, data: updateData });
  }

  async remove(tenantId: string, id: string) {
    await this.ensureExists(tenantId, id);
    return this.prisma.job.delete({ where: { id } });
  }

  async intake(
    tenantId: string,
    data: { rawText: string; vendorId: string; sourceEmail?: string },
  ) {
    const parsed = this.parseJobDescription(data.rawText);

    return this.prisma.job.create({
      data: {
        tenantId,
        vendorId: data.vendorId,
        title: parsed.title,
        description: data.rawText,
        structuredRequirements: parsed.requirements as any,
        skills: parsed.skills,
        location: parsed.location,
        locationType: 'REMOTE',
        status: 'DRAFT',
      },
    });
  }

  private parseJobDescription(rawText: string) {
    const lines = rawText.split('\n').filter((l) => l.trim());
    const title = lines[0]?.trim() ?? 'Untitled Position';

    const skillKeywords = [
      'java', 'python', 'javascript', 'typescript', 'react', 'angular',
      'node', 'aws', 'azure', 'docker', 'kubernetes', 'sql', 'nosql',
      'c#', '.net', 'go', 'rust', 'ruby', 'php', 'swift', 'kotlin',
    ];

    const lowerText = rawText.toLowerCase();
    const skills = skillKeywords.filter((s) => lowerText.includes(s));

    const locationMatch = rawText.match(
      /(?:location|based in|located in)[:\s]+([^\n,]+)/i,
    );

    return {
      title,
      skills,
      location: locationMatch?.[1]?.trim() ?? null,
      requirements: {
        raw: rawText,
        extractedSkills: skills,
        parsedAt: new Date().toISOString(),
      },
    };
  }

  private async ensureExists(tenantId: string, id: string) {
    const job = await this.prisma.job.findFirst({ where: { id, tenantId } });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }
}
