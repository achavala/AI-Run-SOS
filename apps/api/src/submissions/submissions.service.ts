import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MarginGuardService } from '../margin-guard/margin-guard.service';

interface ConsentPolicy {
  autoApproveVendors?: string[];
  autoApproveAboveRate?: number;
  blockVendors?: string[];
  requireExplicitConsent?: boolean;
}

@Injectable()
export class SubmissionsService {
  constructor(
    private prisma: PrismaService,
    private marginGuard: MarginGuardService,
  ) {}

  async findAll(tenantId: string, filters?: { status?: string; dateFrom?: string; dateTo?: string }) {
    const where: any = { tenantId };
    if (filters?.status) where.status = filters.status;
    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters?.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters?.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const submissions = await this.prisma.submission.findMany({
      where,
      include: {
        job: { select: { title: true, vendor: { select: { companyName: true } } } },
        consultant: { select: { firstName: true, lastName: true } },
        consentRecord: { select: { consentType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return submissions.map((s) => ({
      id: s.id,
      jobTitle: s.job.title,
      vendorName: s.job.vendor.companyName,
      consultantName: `${s.consultant.firstName} ${s.consultant.lastName}`,
      status: s.status,
      submitterType: s.submitterType,
      consentType: s.consentRecord?.consentType ?? null,
      marginApproved: s.marginApproved,
      createdAt: s.createdAt.toISOString(),
      feedbackReceivedAt: s.feedbackReceivedAt?.toISOString() ?? null,
    }));
  }

  async findOne(tenantId: string, id: string) {
    const submission = await this.prisma.submission.findFirst({
      where: { id, tenantId },
      include: {
        job: { include: { vendor: true } },
        consultant: true,
        consentRecord: true,
        interviews: { orderBy: { scheduledAt: 'desc' } },
        offers: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!submission) throw new NotFoundException('Submission not found');

    const events = await this.prisma.$queryRaw`
      SELECT id, event_type as "eventType", actor, details, created_at as "createdAt"
      FROM submission_event WHERE submission_id = ${id}
      ORDER BY created_at ASC
    ` as any[];

    const followups = await this.prisma.$queryRaw`
      SELECT id, followup_number as "number", scheduled_at as "scheduledAt",
             sent_at as "sentAt", status
      FROM submission_followup WHERE submission_id = ${id}
      ORDER BY followup_number ASC
    ` as any[];

    return { ...submission, events, followups };
  }

  async create(
    tenantId: string,
    userId: string,
    data: {
      jobId: string;
      consultantId: string;
      resumeVersion?: string;
      rtrDocUrl?: string;
      notes?: string;
      rateCardId?: string;
      overrideMargin?: boolean;
    },
  ) {
    const job = await this.prisma.job.findFirst({
      where: { id: data.jobId, tenantId },
      include: { vendor: true },
    });
    if (!job) throw new NotFoundException('Job not found');

    const consultant = await this.prisma.consultant.findFirst({
      where: { id: data.consultantId, tenantId },
    });
    if (!consultant) throw new NotFoundException('Consultant not found');

    // GUARD: No duplicate submission to same job
    const existingSubmission = await this.prisma.submission.findFirst({
      where: {
        tenantId,
        jobId: data.jobId,
        consultantId: data.consultantId,
        status: { notIn: ['WITHDRAWN', 'REJECTED', 'CLOSED'] },
      },
    });
    if (existingSubmission) {
      throw new ConflictException(
        `Consultant already has an active submission for this job (status: ${existingSubmission.status})`,
      );
    }

    // GUARD: C2C/W2 mismatch detection
    const jobDesc = (job.description || '').toLowerCase();
    const jobTitle = (job.title || '').toLowerCase();
    const consultantSkills = (consultant.skills as any) || [];
    const consultantPolicy = (consultant.consentPolicy ?? {}) as ConsentPolicy;

    const jobIsW2Only = /\bw2\s*only\b/.test(jobDesc) || /\bno\s*c2c\b/i.test(jobDesc) || /\bno\s*third\s*party\b/i.test(jobDesc);
    const jobIsC2COnly = /\bc2c\s*only\b/.test(jobDesc) && !/\bw2\b/.test(jobDesc);

    if (jobIsW2Only && data.notes?.toLowerCase().includes('c2c')) {
      throw new BadRequestException('This job is W2-only. Cannot submit C2C candidate.');
    }

    // GUARD: Margin check
    let marginApproved = false;
    let marginOverrideBy: string | null = null;

    if (data.rateCardId) {
      const marginCheck = await this.marginGuard.checkSubmission(data.rateCardId);
      if (marginCheck && !marginCheck.marginSafe) {
        if (!data.overrideMargin) {
          throw new BadRequestException({
            message: `Margin $${marginCheck.netMarginHr.toFixed(2)}/hr is below $10/hr minimum`,
            netMarginHr: marginCheck.netMarginHr,
            suggestedBillRate: marginCheck.suggestedBillRate,
            breakdown: marginCheck,
          });
        }
        marginOverrideBy = userId;
      }
      marginApproved = true;
    }

    const submission = await this.prisma.submission.create({
      data: {
        tenantId,
        jobId: data.jobId,
        consultantId: data.consultantId,
        submittedById: userId,
        submitterType: 'USER',
        resumeVersionId: data.resumeVersion,
        rtrDocUrl: data.rtrDocUrl,
        notes: data.notes,
        rateCardId: data.rateCardId,
        marginApproved,
        marginOverrideBy,
        status: 'DRAFT',
        duplicateCheckResult: { checked: true, duplicateFound: false },
      },
    });

    await this.logEvent(submission.id, 'CREATED', userId, {
      jobTitle: job.title,
      vendorName: job.vendor.companyName,
      consultantName: `${consultant.firstName} ${consultant.lastName}`,
      marginApproved,
      w2OnlyWarning: jobIsW2Only,
    });

    // Evaluate consent
    const consentResult = this.evaluateConsent(consultantPolicy, job.vendorId, job.rateMax);

    if (consentResult === 'AUTO_APPROVED') {
      await this.prisma.consentRecord.create({
        data: {
          tenantId,
          consultantId: data.consultantId,
          submissionId: submission.id,
          consentType: 'AUTO_POLICY',
          vendorName: job.vendor.companyName,
          jobTitle: job.title,
          rateSubmitted: job.rateMax,
        },
      });

      await this.logEvent(submission.id, 'CONSENT_AUTO_APPROVED', 'system', {});
      return this.prisma.submission.update({
        where: { id: submission.id },
        data: { status: 'SUBMITTED' },
        include: { consentRecord: true },
      });
    }

    if (consentResult === 'BLOCKED') {
      await this.logEvent(submission.id, 'CONSENT_BLOCKED', 'system', { reason: 'Vendor in block list' });
      return this.prisma.submission.update({
        where: { id: submission.id },
        data: { status: 'WITHDRAWN', notes: 'Vendor blocked by consultant consent policy' },
      });
    }

    await this.logEvent(submission.id, 'CONSENT_REQUESTED', 'system', {});
    return this.prisma.submission.update({
      where: { id: submission.id },
      data: { status: 'CONSENT_PENDING' },
    });
  }

  async consent(
    tenantId: string,
    id: string,
    decision: { approved: boolean; consultantId: string },
  ) {
    const submission = await this.prisma.submission.findFirst({
      where: { id, tenantId, status: 'CONSENT_PENDING' },
      include: { job: { include: { vendor: true } } },
    });

    if (!submission) {
      throw new BadRequestException('Submission not found or not awaiting consent');
    }

    if (submission.consultantId !== decision.consultantId) {
      throw new BadRequestException('Only the assigned consultant can consent');
    }

    if (!decision.approved) {
      await this.logEvent(id, 'CONSENT_DENIED', decision.consultantId, {});
      return this.prisma.submission.update({
        where: { id },
        data: { status: 'WITHDRAWN', notes: 'Consultant denied consent' },
      });
    }

    await this.prisma.consentRecord.create({
      data: {
        tenantId,
        consultantId: submission.consultantId,
        submissionId: id,
        consentType: 'EXPLICIT',
        vendorName: submission.job.vendor.companyName,
        jobTitle: submission.job.title,
        rateSubmitted: submission.job.rateMax,
      },
    });

    await this.logEvent(id, 'CONSENT_GIVEN', decision.consultantId, {});

    return this.prisma.submission.update({
      where: { id },
      data: { status: 'SUBMITTED' },
      include: { consentRecord: true },
    });
  }

  async send(tenantId: string, id: string, userId: string) {
    const submission = await this.prisma.submission.findFirst({
      where: { id, tenantId },
      include: {
        job: { include: { vendor: true } },
        consultant: true,
        consentRecord: true,
      },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    if (!submission.consentRecord && submission.status !== 'SUBMITTED') {
      throw new BadRequestException('Consent required before sending');
    }

    // Generate email draft
    const emailDraft = this.generateEmailDraft(submission);

    await this.logEvent(id, 'SENT', userId, { emailDraft: emailDraft.subject });

    // Schedule follow-ups: T+4h, T+24h, T+48h
    const now = new Date();
    const followups = [
      { number: 1, hours: 4 },
      { number: 2, hours: 24 },
      { number: 3, hours: 48 },
    ];

    for (const fu of followups) {
      const scheduledAt = new Date(now.getTime() + fu.hours * 3600000);
      await this.prisma.$executeRaw`
        INSERT INTO submission_followup (submission_id, followup_number, scheduled_at, status)
        VALUES (${id}, ${fu.number}, ${scheduledAt}, 'PENDING')
        ON CONFLICT DO NOTHING
      `;
    }

    await this.prisma.submission.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });

    return { submission: { id, status: 'SUBMITTED' }, emailDraft, followupsScheduled: 3 };
  }

  async updateStatus(
    tenantId: string,
    id: string,
    data: { status: string; vendorFeedback?: string },
    userId?: string,
  ) {
    const submission = await this.prisma.submission.findFirst({
      where: { id, tenantId },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    const updateData: any = { status: data.status };
    if (data.vendorFeedback) {
      updateData.vendorFeedback = data.vendorFeedback;
      updateData.feedbackReceivedAt = new Date();
    }

    await this.logEvent(id, `STATUS_${data.status}`, userId || 'system', {
      previousStatus: submission.status,
      feedback: data.vendorFeedback,
    });

    // Cancel pending follow-ups if terminal status
    if (['REJECTED', 'WITHDRAWN', 'CLOSED', 'ACCEPTED'].includes(data.status)) {
      await this.prisma.$executeRaw`
        UPDATE submission_followup SET status = 'CANCELLED'
        WHERE submission_id = ${id} AND status = 'PENDING'
      `;
    }

    return this.prisma.submission.update({ where: { id }, data: updateData });
  }

  async remove(tenantId: string, id: string) {
    const submission = await this.prisma.submission.findFirst({
      where: { id, tenantId },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    return this.prisma.submission.delete({ where: { id } });
  }

  /* ═══════ Quick Submit from Mail Intel ═══════ */

  async createFromReqSignal(
    tenantId: string,
    userId: string,
    data: { reqSignalId: string; consultantId: string; notes?: string },
  ) {
    const [req] = await this.prisma.$queryRaw`
      SELECT vrs.id, vrs.title, vrs.location, vrs.rate_text, vrs.employment_type,
             vrs.skills, vc.name as vendor_name, vc.domain as vendor_domain,
             vct.email as contact_email, vct.name as contact_name
      FROM vendor_req_signal vrs
      LEFT JOIN vendor_company vc ON vc.id = vrs.vendor_company_id
      LEFT JOIN vendor_contact vct ON vct.id = vrs.vendor_contact_id
      WHERE vrs.id = ${data.reqSignalId}::uuid
    ` as any[];

    if (!req) throw new NotFoundException('Req signal not found');

    const consultant = await this.prisma.consultant.findFirst({
      where: { id: data.consultantId, tenantId },
    });
    if (!consultant) throw new NotFoundException('Consultant not found');

    // Find or create vendor in Prisma Vendor table
    let vendor = await this.prisma.vendor.findFirst({
      where: { tenantId, domain: req.vendor_domain },
    });
    if (!vendor && req.vendor_domain) {
      vendor = await this.prisma.vendor.create({
        data: {
          tenantId,
          companyName: req.vendor_name || req.vendor_domain,
          domain: req.vendor_domain,
          contactName: req.contact_name,
          contactEmail: req.contact_email,
        },
      });
    }

    if (!vendor) {
      throw new BadRequestException('Cannot create submission: vendor information missing from req signal');
    }

    // Create a Job from the req signal
    const job = await this.prisma.job.create({
      data: {
        tenantId,
        vendorId: vendor.id,
        title: req.title || 'Untitled Position',
        description: `Location: ${req.location || 'N/A'}\nRate: ${req.rate_text || 'N/A'}\nEmployment: ${req.employment_type || 'N/A'}\nVendor: ${req.vendor_name || 'Unknown'}\nContact: ${req.contact_name || ''} <${req.contact_email || ''}>`,
        skills: req.skills || [],
        location: req.location,
        status: 'ACTIVE',
      } as any,
    });

    // Create the submission
    return this.create(tenantId, userId, {
      jobId: job.id,
      consultantId: data.consultantId,
      notes: data.notes || `Quick submit from req signal: ${req.title}`,
    });
  }

  /* ═══════ Generate Email Draft ═══════ */

  generateEmailDraft(submission: any) {
    const consultant = submission.consultant;
    const job = submission.job;
    const vendor = job?.vendor;

    const subject = `Submission: ${consultant.firstName} ${consultant.lastName} – ${job.title}`;

    const body = `Hi ${vendor?.contactName || 'Hiring Team'},

I'd like to submit ${consultant.firstName} ${consultant.lastName} for the ${job.title} position${job.location ? ` in ${job.location}` : ''}.

Candidate Summary:
- Name: ${consultant.firstName} ${consultant.lastName}
- Email: ${consultant.email}
${consultant.phone ? `- Phone: ${consultant.phone}` : ''}
- Skills: ${Array.isArray(consultant.skills) ? (consultant.skills as string[]).join(', ') : 'See resume'}
${consultant.desiredRate ? `- Rate: $${consultant.desiredRate}/hr` : ''}

${submission.notes ? `Notes: ${submission.notes}\n` : ''}
Please find the resume attached. RTR is confirmed.

Looking forward to hearing from you.

Best regards`;

    return { to: vendor?.contactEmail || '', subject, body };
  }

  /* ═══════ Follow-up Engine ═══════ */

  async getDueFollowups() {
    return this.prisma.$queryRaw`
      SELECT sf.id, sf.submission_id as "submissionId", sf.followup_number as "number",
             sf.scheduled_at as "scheduledAt",
             s.status as "submissionStatus",
             s.notes,
             s."jobId",
             s."consultantId"
      FROM submission_followup sf
      JOIN "Submission" s ON s.id = sf.submission_id
      WHERE sf.status = 'PENDING'
        AND sf.scheduled_at <= NOW()
        AND s.status IN ('SUBMITTED', 'CONSENT_PENDING')
      ORDER BY sf.scheduled_at ASC
      LIMIT 50
    ` as Promise<any[]>;
  }

  async markFollowupSent(followupId: string) {
    await this.prisma.$executeRaw`
      UPDATE submission_followup SET status = 'SENT', sent_at = NOW()
      WHERE id = ${followupId}::uuid
    `;
  }

  /* ═══════ Dashboard Stats ═══════ */

  async getSubmissionStats(tenantId: string) {
    const stats = await this.prisma.submission.groupBy({
      by: ['status'],
      where: { tenantId },
      _count: true,
    });

    const total = stats.reduce((sum, s) => sum + s._count, 0);
    const pipeline = {
      draft: 0,
      consentPending: 0,
      submitted: 0,
      interviewing: 0,
      offered: 0,
      accepted: 0,
      rejected: 0,
      withdrawn: 0,
      closed: 0,
    };

    for (const s of stats) {
      const key = s.status.toLowerCase().replace('_', '') as string;
      if (key === 'consent_pending') pipeline.consentPending = s._count;
      else if (key in pipeline) (pipeline as any)[key] = s._count;
    }

    return { total, pipeline };
  }

  /* ═══════ Helpers ═══════ */

  private async logEvent(submissionId: string, eventType: string, actor: string | null, details: any) {
    await this.prisma.$executeRaw`
      INSERT INTO submission_event (submission_id, event_type, actor, details)
      VALUES (${submissionId}, ${eventType}, ${actor || 'system'}, ${JSON.stringify(details)}::jsonb)
    `;
  }

  private evaluateConsent(
    policy: ConsentPolicy,
    vendorId: string,
    rate: number | null,
  ): 'AUTO_APPROVED' | 'BLOCKED' | 'NEEDS_CONSENT' {
    if (policy.blockVendors?.includes(vendorId)) {
      return 'BLOCKED';
    }
    if (policy.autoApproveVendors?.includes(vendorId)) {
      return 'AUTO_APPROVED';
    }
    if (policy.autoApproveAboveRate && rate && rate >= policy.autoApproveAboveRate) {
      return 'AUTO_APPROVED';
    }
    if (policy.requireExplicitConsent === false) {
      return 'AUTO_APPROVED';
    }
    return 'NEEDS_CONSENT';
  }
}
