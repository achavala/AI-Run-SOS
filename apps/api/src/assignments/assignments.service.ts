import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  ONBOARDING: ['ACTIVE', 'TERMINATED'],
  ACTIVE: ['ENDING', 'TERMINATED'],
  ENDING: ['COMPLETED', 'TERMINATED'],
};

const DEFAULT_ONBOARDING_CHECKLIST = [
  { key: 'background_check', label: 'Background check cleared', done: false },
  { key: 'i9_verification', label: 'I-9 verification completed', done: false },
  { key: 'nda_signed', label: 'NDA signed', done: false },
  { key: 'client_onboarding', label: 'Client onboarding form submitted', done: false },
  { key: 'equipment_setup', label: 'Equipment / access provisioned', done: false },
  { key: 'timesheet_setup', label: 'Timesheet system configured', done: false },
];

@Injectable()
export class AssignmentsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    const assignments = await this.prisma.assignment.findMany({
      where: { tenantId },
      include: {
        consultant: { select: { firstName: true, lastName: true } },
        job: { select: { title: true } },
        vendor: { select: { companyName: true } },
        clientCompany: { select: { name: true } },
        rateCard: { select: { billRate: true, payRate: true, netMarginHr: true, marginSafe: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return assignments.map((a) => ({
      id: a.id,
      consultantName: `${a.consultant.firstName} ${a.consultant.lastName}`,
      jobTitle: a.job.title,
      vendorName: a.vendor.companyName,
      clientName: a.clientCompany?.name ?? null,
      status: a.status,
      startDate: a.startDate.toISOString(),
      projectedEnd: a.projectedEnd?.toISOString() ?? null,
      rateCard: a.rateCard,
      createdAt: a.createdAt.toISOString(),
    }));
  }

  async findOne(tenantId: string, id: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, tenantId },
      include: {
        consultant: true,
        job: { include: { vendor: true } },
        vendor: true,
        clientCompany: true,
        rateCard: true,
      },
    });

    if (!assignment) throw new NotFoundException('Assignment not found');
    return assignment;
  }

  async create(
    tenantId: string,
    data: {
      offerId: string;
      clientCompanyId?: string;
    },
  ) {
    const offer = await this.prisma.offer.findFirst({
      where: { id: data.offerId, tenantId, status: 'ACCEPTED' },
      include: { submission: { include: { rateCard: true } } },
    });
    if (!offer) {
      throw new BadRequestException('Offer not found or not in ACCEPTED status');
    }

    const placement = await this.prisma.placement.create({
      data: {
        tenantId,
        consultantId: offer.consultantId,
        jobId: offer.jobId,
        vendorId: offer.vendorId,
        startDate: offer.startDate ?? new Date(),
        endDate: offer.endDate,
        billRate: offer.billRate,
        payRate: offer.payRate,
        margin: offer.billRate - offer.payRate,
        status: 'ACTIVE',
      },
    });

    return this.prisma.assignment.create({
      data: {
        tenantId,
        consultantId: offer.consultantId,
        jobId: offer.jobId,
        vendorId: offer.vendorId,
        clientCompanyId: data.clientCompanyId,
        placementId: placement.id,
        rateCardId: offer.submission.rateCardId,
        startDate: offer.startDate ?? new Date(),
        projectedEnd: offer.endDate,
        status: 'ONBOARDING',
        onboardingChecklist: DEFAULT_ONBOARDING_CHECKLIST,
      },
      include: {
        consultant: { select: { firstName: true, lastName: true } },
        job: { select: { title: true } },
        vendor: { select: { companyName: true } },
      },
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    data: { status: string; notes?: string },
  ) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, tenantId },
    });
    if (!assignment) throw new NotFoundException('Assignment not found');

    const allowedNext = STATUS_TRANSITIONS[assignment.status];
    if (!allowedNext || !allowedNext.includes(data.status)) {
      throw new BadRequestException(
        `Cannot transition from ${assignment.status} to ${data.status}. Allowed: ${allowedNext?.join(', ') ?? 'none'}`,
      );
    }

    const updateData: any = { status: data.status };
    if (data.status === 'COMPLETED' || data.status === 'TERMINATED') {
      updateData.actualEnd = new Date();
    }

    return this.prisma.assignment.update({
      where: { id },
      data: updateData,
    });
  }

  async getOnboarding(tenantId: string, id: string) {
    const assignment = await this.prisma.assignment.findFirst({
      where: { id, tenantId },
      select: {
        id: true,
        status: true,
        onboardingChecklist: true,
        consultant: { select: { firstName: true, lastName: true } },
        job: { select: { title: true } },
      },
    });

    if (!assignment) throw new NotFoundException('Assignment not found');

    return {
      assignmentId: assignment.id,
      status: assignment.status,
      consultantName: `${assignment.consultant.firstName} ${assignment.consultant.lastName}`,
      jobTitle: assignment.job.title,
      checklist: assignment.onboardingChecklist,
    };
  }
}
