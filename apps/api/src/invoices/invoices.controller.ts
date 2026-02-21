import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/tenant.decorator';
import { InvoicesService } from './invoices.service';

@Controller('invoices')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvoicesController {
  constructor(private invoicesService: InvoicesService) {}

  @Get()
  @Roles('MANAGEMENT', 'ACCOUNTS', 'SALES')
  findAll(@CurrentTenant() tenantId: string) {
    return this.invoicesService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('MANAGEMENT', 'ACCOUNTS', 'SALES')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.invoicesService.findOne(tenantId, id);
  }

  @Post()
  @Roles('MANAGEMENT', 'ACCOUNTS')
  create(
    @CurrentTenant() tenantId: string,
    @Body()
    body: {
      vendorId: string;
      periodStart: string;
      periodEnd: string;
      totalAmount: number;
    },
  ) {
    return this.invoicesService.create(tenantId, body);
  }

  @Patch(':id/status')
  @Roles('MANAGEMENT', 'ACCOUNTS')
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      status: string;
      paidAmount?: number;
      paidAt?: string;
    },
  ) {
    return this.invoicesService.updateStatus(tenantId, id, body);
  }

  @Delete(':id')
  @Roles('MANAGEMENT')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.invoicesService.remove(tenantId, id);
  }
}
