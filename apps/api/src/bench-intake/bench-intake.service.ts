import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiPipelineService } from './ai-pipeline.service';
import { createHash } from 'crypto';

@Injectable()
export class BenchIntakeService {
  private readonly logger = new Logger(BenchIntakeService.name);

  constructor(
    private prisma: PrismaService,
    private aiPipeline: AiPipelineService,
  ) {}

  /* ── Add consultant to bench ─────────────────────────────── */

  async addConsultant(
    tenantId: string,
    data: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      skills?: string[];
      visaType?: string;
      desiredRate?: number;
      availableFrom?: string;
    },
    userId: string,
    file?: Express.Multer.File,
  ) {
    const consultant = await this.prisma.consultant.create({
      data: {
        tenantId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        skills: data.skills || [],
        desiredRate: data.desiredRate || null,
        availableFrom: data.availableFrom ? new Date(data.availableFrom) : null,
        benchStatus: 'NEW',
        readiness: 'NEW',
      },
    });

    // Create work auth record if visa type provided
    if (data.visaType) {
      await this.prisma.consultantWorkAuth.create({
        data: {
          tenantId,
          consultantId: consultant.id,
          authType: data.visaType as any,
          isCurrent: true,
        },
      });
    }

    // Handle resume upload
    let document: any = null;
    let resumeVersion: any = null;

    if (file) {
      const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      const fileHash = createHash('sha256').update(file.buffer).digest('hex');

      [document, resumeVersion] = await Promise.all([
        this.prisma.consultantDocument.create({
          data: {
            tenantId,
            consultantId: consultant.id,
            docType: 'ORIGINAL_RESUME',
            fileName: file.originalname,
            fileUrl: dataUri,
            mimeType: file.mimetype,
            fileSizeBytes: file.size,
          },
        }),
        this.prisma.resumeVersion.create({
          data: {
            tenantId,
            consultantId: consultant.id,
            version: 'v1.0-original',
            fileUrl: dataUri,
            fileHash,
            source: 'uploaded',
            isCurrent: true,
          },
        }),
      ]);
    }

    // Create initial activity
    await this.prisma.consultantActivity.create({
      data: {
        tenantId,
        consultantId: consultant.id,
        activityType: 'CONSULTANT_ADDED',
        title: 'Consultant added to bench',
        description: `${data.firstName} ${data.lastName} was added to the current bench${file ? ' with resume' : ''}.`,
        metadata: {
          skills: data.skills || [],
          visaType: data.visaType || null,
          hasResume: !!file,
        },
        createdBy: userId,
      },
    });

    // Trigger AI pipeline (fire & forget)
    setTimeout(() => {
      this.aiPipeline
        .runPipeline(tenantId, consultant.id)
        .catch((err) => this.logger.error(`AI pipeline failed for ${consultant.id}: ${err.message}`));
    }, 0);

    // Return consultant with initial AI run info
    const aiRun = await this.prisma.consultantAiRun.findFirst({
      where: { consultantId: consultant.id },
      orderBy: { createdAt: 'desc' },
    });

    return {
      consultant,
      document,
      resumeVersion,
      aiRun,
      message: 'Consultant added successfully. AI pipeline triggered.',
    };
  }

  /* ── List current bench ──────────────────────────────────── */

  async getCurrentBench(
    tenantId: string,
    filters: {
      search?: string;
      status?: string;
      sort?: string;
      page?: number;
      pageSize?: number;
    },
  ) {
    const page = filters.page || 1;
    const pageSize = filters.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {
      tenantId,
      benchStatus: { not: null },
    };

    if (filters.status) {
      where.benchStatus = filters.status;
    }

    if (filters.search) {
      const term = filters.search.trim();
      where.OR = [
        { firstName: { contains: term, mode: 'insensitive' } },
        { lastName: { contains: term, mode: 'insensitive' } },
        { email: { contains: term, mode: 'insensitive' } },
      ];
    }

    // Determine sort order
    let orderBy: any = { createdAt: 'desc' };
    switch (filters.sort) {
      case 'name-asc':
        orderBy = { firstName: 'asc' };
        break;
      case 'name-desc':
        orderBy = { firstName: 'desc' };
        break;
      case 'readiness-desc':
        orderBy = { readinessScore: 'desc' };
        break;
      case 'readiness-asc':
        orderBy = { readinessScore: 'asc' };
        break;
      case 'newest':
        orderBy = { createdAt: 'desc' };
        break;
      case 'oldest':
        orderBy = { createdAt: 'asc' };
        break;
    }

    const [consultants, total] = await Promise.all([
      this.prisma.consultant.findMany({
        where,
        orderBy,
        skip,
        take: pageSize,
        include: {
          workAuths: { where: { isCurrent: true }, take: 1 },
          aiRuns: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              id: true,
              status: true,
              currentStep: true,
              stepsCompleted: true,
              totalSteps: true,
              readinessScore: true,
              completedAt: true,
            },
          },
          documents: {
            where: { docType: 'ORIGINAL_RESUME' },
            take: 1,
            select: { id: true, fileName: true, createdAt: true },
          },
        },
      }),
      this.prisma.consultant.count({ where }),
    ]);

    const items = consultants.map((c) => {
      const latestRun = c.aiRuns[0] || null;
      const visa = c.workAuths[0]?.authType || null;
      const hasResume = c.documents.length > 0;

      return {
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email,
        phone: c.phone,
        skills: c.skills,
        benchStatus: c.benchStatus,
        readinessScore: c.readinessScore,
        desiredRate: c.desiredRate,
        availableFrom: c.availableFrom,
        visa,
        hasResume,
        resumeFileName: c.documents[0]?.fileName || null,
        aiRun: latestRun
          ? {
              id: latestRun.id,
              status: latestRun.status,
              currentStep: latestRun.currentStep,
              stepsCompleted: latestRun.stepsCompleted,
              totalSteps: latestRun.totalSteps,
              readinessScore: latestRun.readinessScore,
              completedAt: latestRun.completedAt,
            }
          : null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  /* ── Full consultant detail ──────────────────────────────── */

  async getConsultantDetail(tenantId: string, id: string) {
    const consultant = await this.prisma.consultant.findFirst({
      where: { id, tenantId },
      include: {
        workAuths: { where: { isCurrent: true } },
        resumeVersions: { orderBy: { createdAt: 'desc' }, take: 5 },
        documents: { orderBy: { createdAt: 'desc' } },
        aiRuns: {
          orderBy: { createdAt: 'desc' },
          take: 3,
          include: {
            outputs: {
              orderBy: { step: 'asc' },
            },
          },
        },
        activities: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!consultant) {
      throw new NotFoundException(`Consultant ${id} not found`);
    }

    return consultant;
  }

  /* ── AI pipeline status ──────────────────────────────────── */

  async getAiStatus(tenantId: string, consultantId: string) {
    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
      select: { id: true, firstName: true, lastName: true },
    });

    if (!consultant) {
      throw new NotFoundException(`Consultant ${consultantId} not found`);
    }

    const latestRun = await this.prisma.consultantAiRun.findFirst({
      where: { consultantId, tenantId },
      orderBy: { createdAt: 'desc' },
      include: {
        outputs: {
          orderBy: { step: 'asc' },
          select: {
            id: true,
            step: true,
            status: true,
            durationMs: true,
            tokensUsed: true,
            errorMessage: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    });

    if (!latestRun) {
      return {
        consultant,
        aiRun: null,
        message: 'No AI pipeline run found for this consultant.',
      };
    }

    const allSteps = [
      'RESUME_PARSING',
      'RESUME_PREP',
      'TECH_PREP',
      'COACHING',
      'LINKEDIN_PREP',
      'SALES_STRATEGY',
      'JOB_SEARCH',
      'GM_STRATEGIST',
    ];

    const outputMap = new Map(latestRun.outputs.map((o) => [o.step, o]));

    const steps = allSteps.map((step) => {
      const output = outputMap.get(step as any);
      return {
        step,
        status: output?.status || 'QUEUED',
        durationMs: output?.durationMs || null,
        tokensUsed: output?.tokensUsed || null,
        errorMessage: output?.errorMessage || null,
      };
    });

    return {
      consultant,
      aiRun: {
        id: latestRun.id,
        status: latestRun.status,
        currentStep: latestRun.currentStep,
        stepsCompleted: latestRun.stepsCompleted,
        totalSteps: latestRun.totalSteps,
        readinessScore: latestRun.readinessScore,
        errorMessage: latestRun.errorMessage,
        startedAt: latestRun.startedAt,
        completedAt: latestRun.completedAt,
        steps,
      },
    };
  }

  /* ── Re-trigger AI pipeline ──────────────────────────────── */

  async triggerAi(tenantId: string, consultantId: string) {
    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
    });

    if (!consultant) {
      throw new NotFoundException(`Consultant ${consultantId} not found`);
    }

    // Fire & forget
    setTimeout(() => {
      this.aiPipeline
        .runPipeline(tenantId, consultantId)
        .catch((err) => this.logger.error(`AI pipeline re-trigger failed for ${consultantId}: ${err.message}`));
    }, 0);

    return {
      message: 'AI pipeline triggered successfully.',
      consultantId,
    };
  }

  /* ── Update bench status ─────────────────────────────────── */

  async updateStatus(tenantId: string, consultantId: string, status: string, userId: string) {
    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
    });

    if (!consultant) {
      throw new NotFoundException(`Consultant ${consultantId} not found`);
    }

    const previousStatus = consultant.benchStatus;

    const updated = await this.prisma.consultant.update({
      where: { id: consultantId },
      data: { benchStatus: status as any },
    });

    await this.prisma.consultantActivity.create({
      data: {
        tenantId,
        consultantId,
        activityType: 'STATUS_CHANGED',
        title: `Bench status changed to ${status}`,
        description: `Status updated from ${previousStatus} to ${status}.`,
        metadata: {
          previousStatus,
          newStatus: status,
        },
        createdBy: userId,
      },
    });

    return updated;
  }

  /* ── Activity timeline ───────────────────────────────────── */

  async getActivities(tenantId: string, consultantId: string, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
      select: { id: true },
    });

    if (!consultant) {
      throw new NotFoundException(`Consultant ${consultantId} not found`);
    }

    const [items, total] = await Promise.all([
      this.prisma.consultantActivity.findMany({
        where: { tenantId, consultantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.consultantActivity.count({
        where: { tenantId, consultantId },
      }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }
}
