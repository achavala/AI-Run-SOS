import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface ConsentPolicy {
  autoApproveVendors?: string[];
  autoApproveAboveRate?: number;
  blockVendors?: string[];
  requireExplicitConsent?: boolean;
}

@Injectable()
export class SubmissionsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const submissions = await this.prisma.submission.findMany({
      where: { tenantId },
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
      },
    });

    if (!submission) throw new NotFoundException('Submission not found');
    return submission;
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

    const submission = await this.prisma.submission.create({
      data: {
        tenantId,
        jobId: data.jobId,
        consultantId: data.consultantId,
        submittedById: userId,
        submitterType: 'USER',
        resumeVersion: data.resumeVersion,
        rtrDocUrl: data.rtrDocUrl,
        notes: data.notes,
        status: 'DRAFT',
      },
    });

    const policy = (consultant.consentPolicy ?? {}) as ConsentPolicy;
    const consentResult = this.evaluateConsent(policy, job.vendorId, job.rateMax);

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

      return this.prisma.submission.update({
        where: { id: submission.id },
        data: { status: 'SUBMITTED' },
        include: { consentRecord: true },
      });
    }

    if (consentResult === 'BLOCKED') {
      return this.prisma.submission.update({
        where: { id: submission.id },
        data: { status: 'WITHDRAWN', notes: 'Vendor blocked by consultant consent policy' },
      });
    }

    return this.prisma.submission.update({
      where: { id: submission.id },
      data: { status: 'AWAITING_CONSENT' },
    });
  }

  async consent(
    tenantId: string,
    id: string,
    decision: { approved: boolean; consultantId: string },
  ) {
    const submission = await this.prisma.submission.findFirst({
      where: { id, tenantId, status: 'AWAITING_CONSENT' },
      include: { job: { include: { vendor: true } } },
    });

    if (!submission) {
      throw new BadRequestException('Submission not found or not awaiting consent');
    }

    if (submission.consultantId !== decision.consultantId) {
      throw new BadRequestException('Only the assigned consultant can consent');
    }

    if (!decision.approved) {
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

    return this.prisma.submission.update({
      where: { id },
      data: { status: 'SUBMITTED' },
      include: { consentRecord: true },
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    data: { status: string; vendorFeedback?: string },
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

    return this.prisma.submission.update({ where: { id }, data: updateData });
  }

  async remove(tenantId: string, id: string) {
    const submission = await this.prisma.submission.findFirst({
      where: { id, tenantId },
    });
    if (!submission) throw new NotFoundException('Submission not found');

    return this.prisma.submission.delete({ where: { id } });
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

    if (
      policy.autoApproveAboveRate &&
      rate &&
      rate >= policy.autoApproveAboveRate
    ) {
      return 'AUTO_APPROVED';
    }

    if (policy.requireExplicitConsent === false) {
      return 'AUTO_APPROVED';
    }

    return 'NEEDS_CONSENT';
  }
}
