import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TimesheetsService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.timesheet.findMany({
      where: { tenantId },
      include: {
        consultant: { select: { firstName: true, lastName: true } },
        placement: {
          select: {
            job: { select: { title: true } },
            vendor: { select: { companyName: true } },
            billRate: true,
            payRate: true,
          },
        },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
      orderBy: { weekEnding: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const timesheet = await this.prisma.timesheet.findFirst({
      where: { id, tenantId },
      include: {
        consultant: true,
        placement: {
          include: {
            job: true,
            vendor: true,
          },
        },
        approvedBy: { select: { firstName: true, lastName: true, email: true } },
      },
    });

    if (!timesheet) throw new NotFoundException('Timesheet not found');
    return timesheet;
  }

  async create(
    tenantId: string,
    data: {
      placementId: string;
      weekEnding: string;
      hoursRegular?: number;
      hoursOvertime?: number;
    },
  ) {
    const placement = await this.prisma.placement.findFirst({
      where: { id: data.placementId, tenantId },
    });
    if (!placement) throw new NotFoundException('Placement not found');

    return this.prisma.timesheet.create({
      data: {
        tenantId,
        placementId: data.placementId,
        consultantId: placement.consultantId,
        weekEnding: new Date(data.weekEnding),
        hoursRegular: data.hoursRegular ?? 0,
        hoursOvertime: data.hoursOvertime ?? 0,
        status: 'DRAFT',
      },
    });
  }

  async update(
    tenantId: string,
    id: string,
    data: {
      hoursRegular?: number;
      hoursOvertime?: number;
    },
  ) {
    const timesheet = await this.ensureExists(tenantId, id);
    if (timesheet.status !== 'DRAFT' && timesheet.status !== 'REJECTED') {
      throw new BadRequestException(
        'Can only edit timesheets in DRAFT or REJECTED status',
      );
    }

    return this.prisma.timesheet.update({ where: { id }, data });
  }

  async submit(tenantId: string, id: string) {
    const timesheet = await this.ensureExists(tenantId, id);
    if (timesheet.status !== 'DRAFT' && timesheet.status !== 'REJECTED') {
      throw new BadRequestException('Can only submit from DRAFT or REJECTED');
    }

    return this.prisma.timesheet.update({
      where: { id },
      data: { status: 'SUBMITTED' },
    });
  }

  async approve(
    tenantId: string,
    id: string,
    approverId: string,
    decision: { status: 'APPROVED' | 'REJECTED'; notes?: string },
  ) {
    const timesheet = await this.ensureExists(tenantId, id);
    if (timesheet.status !== 'SUBMITTED') {
      throw new BadRequestException('Can only approve/reject submitted timesheets');
    }

    return this.prisma.timesheet.update({
      where: { id },
      data: {
        status: decision.status,
        approvedById: decision.status === 'APPROVED' ? approverId : null,
        approvedAt: decision.status === 'APPROVED' ? new Date() : null,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    const timesheet = await this.ensureExists(tenantId, id);
    if (timesheet.status !== 'DRAFT') {
      throw new BadRequestException('Can only delete draft timesheets');
    }
    return this.prisma.timesheet.delete({ where: { id } });
  }

  private async ensureExists(tenantId: string, id: string) {
    const timesheet = await this.prisma.timesheet.findFirst({
      where: { id, tenantId },
    });
    if (!timesheet) throw new NotFoundException('Timesheet not found');
    return timesheet;
  }
}
