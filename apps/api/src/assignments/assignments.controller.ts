import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/tenant.decorator';
import { AssignmentsService } from './assignments.service';

@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private assignmentsService: AssignmentsService) {}

  @Get()
  @Roles('MANAGEMENT', 'RECRUITMENT', 'HR', 'ACCOUNTS')
  findAll(@CurrentTenant() tenantId: string) {
    return this.assignmentsService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'HR', 'ACCOUNTS')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.assignmentsService.findOne(tenantId, id);
  }

  @Post()
  @Roles('MANAGEMENT', 'RECRUITMENT', 'HR')
  create(
    @CurrentTenant() tenantId: string,
    @Body() body: { offerId: string; clientCompanyId?: string },
  ) {
    return this.assignmentsService.create(tenantId, body);
  }

  @Patch(':id/status')
  @Roles('MANAGEMENT', 'HR')
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { status: string; notes?: string },
  ) {
    return this.assignmentsService.updateStatus(tenantId, id, body);
  }

  @Get(':id/onboarding')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'HR')
  getOnboarding(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.assignmentsService.getOnboarding(tenantId, id);
  }
}
