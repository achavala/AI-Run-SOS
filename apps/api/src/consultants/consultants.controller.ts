import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/tenant.decorator';
import { ConsultantsService } from './consultants.service';

@Controller('consultants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ConsultantsController {
  constructor(private consultantsService: ConsultantsService) {}

  @Get()
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES', 'HR')
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('search') search?: string,
    @Query('readiness') readiness?: string,
  ) {
    return this.consultantsService.findAll(tenantId, {
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
      search,
      readiness,
    });
  }

  @Get(':id')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES', 'HR')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.consultantsService.findOne(tenantId, id);
  }

  @Post()
  @Roles('MANAGEMENT', 'RECRUITMENT', 'HR')
  create(
    @CurrentTenant() tenantId: string,
    @Body()
    body: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      skills?: string[];
      visaStatus?: string;
      workAuthExpiry?: string;
      availableFrom?: string;
      desiredRate?: number;
    },
  ) {
    return this.consultantsService.create(tenantId, body);
  }

  @Patch(':id')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'HR')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      skills?: string[];
      visaStatus?: string;
      workAuthExpiry?: string;
      availableFrom?: string;
      desiredRate?: number;
    },
  ) {
    return this.consultantsService.update(tenantId, id, body);
  }

  @Patch(':id/consent-policy')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'CONSULTANT')
  updateConsentPolicy(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      autoApproveVendors?: string[];
      autoApproveAboveRate?: number;
      blockVendors?: string[];
      requireExplicitConsent?: boolean;
    },
  ) {
    return this.consultantsService.updateConsentPolicy(tenantId, id, body);
  }

  @Delete(':id')
  @Roles('MANAGEMENT')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.consultantsService.remove(tenantId, id);
  }
}
