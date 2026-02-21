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
import { VendorsService } from './vendors.service';

@Controller('vendors')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorsController {
  constructor(private vendorsService: VendorsService) {}

  @Get()
  @Roles('MANAGEMENT', 'SALES', 'RECRUITMENT', 'ACCOUNTS')
  findAll(@CurrentTenant() tenantId: string) {
    return this.vendorsService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('MANAGEMENT', 'SALES', 'RECRUITMENT', 'ACCOUNTS')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.vendorsService.findOne(tenantId, id);
  }

  @Post()
  @Roles('MANAGEMENT', 'SALES')
  create(
    @CurrentTenant() tenantId: string,
    @Body()
    body: {
      companyName: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      paymentTermsDays?: number;
    },
  ) {
    return this.vendorsService.create(tenantId, body);
  }

  @Patch(':id')
  @Roles('MANAGEMENT', 'SALES')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      companyName?: string;
      contactName?: string;
      contactEmail?: string;
      contactPhone?: string;
      paymentTermsDays?: number;
    },
  ) {
    return this.vendorsService.update(tenantId, id, body);
  }

  @Delete(':id')
  @Roles('MANAGEMENT')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.vendorsService.remove(tenantId, id);
  }
}
