import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AiPipelineService } from './ai-pipeline.service';
import { createHash } from 'crypto';
import * as mammoth from 'mammoth';

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

    if (filters.status && filters.status !== 'ALL') {
      where.benchStatus = filters.status;
    }

    if (filters.search) {
      const term = filters.search.trim();
      where.OR = [
        { firstName: { contains: term } },
        { lastName: { contains: term } },
        { email: { contains: term } },
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

  /* ── Update consultant details ──────────────────────────── */

  async updateConsultant(
    tenantId: string,
    consultantId: string,
    data: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      skills?: string[];
      desiredRate?: number;
      availableFrom?: string;
    },
    userId: string,
  ) {
    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
    });

    if (!consultant) {
      throw new NotFoundException(`Consultant ${consultantId} not found`);
    }

    const updateData: any = {};
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.email) updateData.email = data.email;
    if (data.phone !== undefined) updateData.phone = data.phone || null;
    if (data.skills) updateData.skills = data.skills;
    if (data.desiredRate !== undefined) updateData.desiredRate = data.desiredRate || null;
    if (data.availableFrom) updateData.availableFrom = new Date(data.availableFrom);

    const updated = await this.prisma.consultant.update({
      where: { id: consultantId },
      data: updateData,
    });

    await this.prisma.consultantActivity.create({
      data: {
        tenantId,
        consultantId,
        activityType: 'PROFILE_UPDATED',
        title: 'Consultant profile updated',
        description: `Updated fields: ${Object.keys(updateData).join(', ')}.`,
        metadata: { updatedFields: Object.keys(updateData) },
        createdBy: userId,
      },
    });

    return updated;
  }

  /* ── Upload resume to existing consultant ────────────────── */

  async uploadResume(tenantId: string, consultantId: string, file: Express.Multer.File, userId: string) {
    const consultant = await this.prisma.consultant.findFirst({
      where: { id: consultantId, tenantId },
    });

    if (!consultant) {
      throw new NotFoundException(`Consultant ${consultantId} not found`);
    }

    const dataUri = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');

    // Mark previous resume versions as not current
    await this.prisma.resumeVersion.updateMany({
      where: { consultantId, isCurrent: true },
      data: { isCurrent: false },
    });

    const [document, resumeVersion] = await Promise.all([
      this.prisma.consultantDocument.create({
        data: {
          tenantId,
          consultantId,
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
          consultantId,
          version: `v${Date.now()}`,
          fileUrl: dataUri,
          fileHash,
          source: 'uploaded',
          isCurrent: true,
        },
      }),
    ]);

    await this.prisma.consultantActivity.create({
      data: {
        tenantId,
        consultantId,
        activityType: 'RESUME_UPLOADED',
        title: 'Resume uploaded',
        description: `Resume "${file.originalname}" uploaded (${(file.size / 1024).toFixed(0)} KB).`,
        metadata: { fileName: file.originalname, fileSize: file.size },
        createdBy: userId,
      },
    });

    return { document, resumeVersion, message: 'Resume uploaded successfully' };
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

  /* ── Parse resume and extract details ─────────────────────── */

  async parseResume(file: Express.Multer.File) {
    if (!file) throw new BadRequestException('No file provided');

    let text = '';

    try {
      if (file.mimetype === 'application/pdf' || file.originalname?.endsWith('.pdf')) {
        const { getDocument } = await import('pdfjs-dist/legacy/build/pdf.mjs');
        const uint8 = new Uint8Array(file.buffer);
        const doc = await getDocument({ data: uint8, useSystemFonts: true }).promise;
        const pages: string[] = [];
        for (let i = 1; i <= doc.numPages; i++) {
          const page = await doc.getPage(i);
          const content = await page.getTextContent();
          // Group items by Y position to reconstruct lines
          const items = (content.items as any[]).filter((it) => it.str?.trim());
          if (items.length === 0) continue;
          let lastY = items[0]?.transform?.[5] ?? 0;
          let currentLine = '';
          const pageLines: string[] = [];
          for (const item of items) {
            const y = item.transform?.[5] ?? lastY;
            if (Math.abs(y - lastY) > 3) {
              if (currentLine.trim()) pageLines.push(currentLine.trim());
              currentLine = item.str;
            } else {
              currentLine += (currentLine ? ' ' : '') + item.str;
            }
            lastY = y;
          }
          if (currentLine.trim()) pageLines.push(currentLine.trim());
          pages.push(pageLines.join('\n'));
        }
        text = pages.join('\n');
      } else if (
        file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        file.originalname?.endsWith('.docx')
      ) {
        const result = await mammoth.extractRawText({ buffer: file.buffer });
        text = result.value;
      } else if (
        file.mimetype === 'application/msword' ||
        file.originalname?.endsWith('.doc')
      ) {
        // .doc files — best-effort text extraction
        text = file.buffer.toString('utf-8').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
      } else {
        throw new BadRequestException('Unsupported file type. Upload PDF, DOC, or DOCX.');
      }
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Resume parse error: ${(err as Error).message}`);
      throw new BadRequestException('Failed to parse resume file');
    }

    if (!text || text.trim().length < 20) {
      throw new BadRequestException('Could not extract meaningful text from resume. Please ensure the file is not scanned/image-only.');
    }

    return this.extractDetailsFromText(text);
  }

  private extractDetailsFromText(text: string) {
    // Split on newlines and common separators (|, pipes in PDF text)
    const rawLines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
    // Also split long lines on pipe/vertical bar separators
    const lines: string[] = [];
    for (const line of rawLines) {
      if (line.includes('|')) {
        lines.push(...line.split('|').map((s) => s.trim()).filter(Boolean));
      } else {
        lines.push(line);
      }
    }

    // ── Email ──
    const emailMatch = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
    const email = emailMatch?.[0] || '';

    // ── Phone ──
    const phoneMatch = text.match(
      /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.\-]?\d{3}[\s.\-]?\d{4}/,
    );
    const phone = phoneMatch?.[0]?.replace(/[^\d+() .-]/g, '').trim() || '';

    // ── Name — try multiple strategies ──
    let firstName = '';
    let lastName = '';

    // Strategy 1: Look for a segment that contains only 2-3 capitalized words (name-like)
    for (const segment of lines.slice(0, 10)) {
      const cleaned = segment.replace(/[^a-zA-Z\s.''-]/g, '').trim();
      if (!cleaned || cleaned.length < 3 || cleaned.length > 40) continue;
      // Skip headers/labels
      if (/^(resume|curriculum|vitae|objective|summary|profile|contact|technical|skills|experience|education|senior|junior|lead|engineer)/i.test(cleaned)) continue;
      // Skip segments with email/phone
      if (/@/.test(segment) || /\d{3}.*\d{4}/.test(segment)) continue;
      // A name is typically 2-3 words, all capitalized
      const words = cleaned.split(/\s+/).filter((w) => w.length >= 2);
      if (words.length >= 2 && words.length <= 4 && words.every((w) => /^[A-Z]/.test(w))) {
        firstName = words[0] ?? '';
        lastName = words.slice(1).join(' ');
        break;
      }
    }

    // Strategy 2: Take the first segment that looks like a name (2+ alpha words)
    if (!firstName) {
      for (const segment of lines.slice(0, 8)) {
        const cleaned = segment.replace(/[^a-zA-Z\s.-]/g, '').trim();
        if (!cleaned || cleaned.length < 3) continue;
        if (/^(resume|curriculum|vitae|objective|summary|profile|contact|technical|skills)/i.test(cleaned)) continue;
        if (/@/.test(segment) || /\d{3}.*\d{4}/.test(segment)) continue;

        const nameParts = cleaned.split(/\s+/).filter((p) => p.length >= 2);
        if (nameParts.length >= 2 && nameParts.length <= 4) {
          firstName = nameParts[0] ?? '';
          lastName = nameParts.slice(1).join(' ');
          break;
        }
      }
    }

    // ── Skills — look for known tech keywords ──
    const KNOWN_SKILLS = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C#', 'C\\+\\+', 'Go', 'Rust', 'Ruby', 'PHP', 'Swift', 'Kotlin',
      'React', 'Angular', 'Vue', 'Next\\.js', 'Node\\.js', 'Express', 'NestJS', 'Django', 'Flask', 'Spring Boot',
      'AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'Terraform', 'Jenkins', 'CI/CD',
      'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Elasticsearch', 'DynamoDB', 'SQL Server', 'Oracle',
      'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'TensorFlow', 'PyTorch', 'Scikit-learn',
      'REST', 'GraphQL', 'gRPC', 'Microservices', 'Kafka', 'RabbitMQ',
      'Git', 'Linux', 'Agile', 'Scrum', 'Jira',
      'HTML', 'CSS', 'SASS', 'Tailwind', 'Bootstrap',
      'Power BI', 'Tableau', 'Snowflake', 'Spark', 'Hadoop', 'Airflow', 'dbt',
      'Figma', 'Sketch', 'UI/UX',
      'Salesforce', 'SAP', 'ServiceNow',
      'Selenium', 'Cypress', 'Jest', 'JUnit',
      'iOS', 'Android', 'React Native', 'Flutter',
      'Blockchain', 'Solidity', 'Web3',
      'DevOps', 'SRE', 'Observability', 'Prometheus', 'Grafana', 'Datadog',
      'Pandas', 'NumPy', 'R',
      '.NET', 'ASP\\.NET',
    ];

    const skills: string[] = [];
    const seen = new Set<string>();
    for (const skill of KNOWN_SKILLS) {
      const regex = new RegExp(`\\b${skill}\\b`, 'i');
      if (regex.test(text) && !seen.has(skill.toLowerCase().replace(/\\/g, ''))) {
        // Use the canonical name (without regex escapes)
        const clean = skill.replace(/\\/g, '');
        skills.push(clean);
        seen.add(clean.toLowerCase());
      }
    }

    // ── Visa — check for mentions ──
    let visaType = '';
    if (/\bUS\s*Citizen\b/i.test(text) || /\bUSC\b/.test(text)) visaType = 'USC';
    else if (/\bGreen\s*Card\b/i.test(text) || /\bPermanent\s*Resident\b/i.test(text)) visaType = 'GC';
    else if (/\bH[\s-]?1B\b/i.test(text)) visaType = 'H1B';
    else if (/\bL[\s-]?1\b/i.test(text)) visaType = 'L1';
    else if (/\bOPT\b/.test(text)) visaType = 'OPT';
    else if (/\bCPT\b/.test(text)) visaType = 'CPT';
    else if (/\bEAD\b/.test(text)) visaType = 'EAD';
    else if (/\bTN\s*Visa\b/i.test(text)) visaType = 'TN';

    return {
      firstName,
      lastName,
      email,
      phone,
      skills,
      visaType,
    };
  }
}
