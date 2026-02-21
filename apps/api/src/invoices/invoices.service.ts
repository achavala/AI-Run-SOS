import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InvoicesService {
  constructor(private prisma: PrismaService) {}

  async findAll(tenantId: string) {
    return this.prisma.invoice.findMany({
      where: { tenantId },
      include: {
        vendor: { select: { companyName: true } },
        _count: { select: { payments: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
      include: {
        vendor: true,
        payments: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async create(
    tenantId: string,
    data: {
      vendorId: string;
      periodStart: string;
      periodEnd: string;
      totalAmount: number;
    },
  ) {
    const vendor = await this.prisma.vendor.findFirst({
      where: { id: data.vendorId, tenantId },
    });
    if (!vendor) throw new NotFoundException('Vendor not found');

    const count = await this.prisma.invoice.count({ where: { tenantId } });
    const invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;

    return this.prisma.invoice.create({
      data: {
        tenantId,
        vendorId: data.vendorId,
        invoiceNumber,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        totalAmount: data.totalAmount,
        status: 'DRAFT',
        dueDate: this.calculateDueDate(vendor.paymentTermsDays),
      },
    });
  }

  async updateStatus(
    tenantId: string,
    id: string,
    data: {
      status: string;
      paidAmount?: number;
      paidAt?: string;
    },
  ) {
    const invoice = await this.ensureExists(tenantId, id);

    const updateData: any = { status: data.status };

    if (data.status === 'SENT' && !invoice.sentAt) {
      updateData.sentAt = new Date();
    }

    if (data.status === 'PAID' || data.status === 'PARTIAL') {
      if (data.paidAmount) {
        updateData.paidAmount = (invoice.paidAmount ?? 0) + data.paidAmount;

        await this.prisma.payment.create({
          data: {
            tenantId,
            invoiceId: id,
            amount: data.paidAmount,
            paymentDate: data.paidAt ? new Date(data.paidAt) : new Date(),
            status: 'COMPLETED',
          },
        });
      }

      if (data.paidAt) {
        updateData.paidAt = new Date(data.paidAt);
      }
    }

    return this.prisma.invoice.update({
      where: { id },
      data: updateData,
      include: { payments: true },
    });
  }

  async remove(tenantId: string, id: string) {
    const invoice = await this.ensureExists(tenantId, id);
    if (invoice.status !== 'DRAFT') {
      throw new BadRequestException('Can only delete draft invoices');
    }
    return this.prisma.invoice.delete({ where: { id } });
  }

  private calculateDueDate(paymentTermsDays: number): Date {
    const due = new Date();
    due.setDate(due.getDate() + paymentTermsDays);
    return due;
  }

  private async ensureExists(tenantId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({
      where: { id, tenantId },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }
}
