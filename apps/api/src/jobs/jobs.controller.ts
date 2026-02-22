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
import { JobsService } from './jobs.service';

@Controller('jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobsController {
  constructor(private jobsService: JobsService) {}

  @Get()
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  findAll(@CurrentTenant() tenantId: string) {
    return this.jobsService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.jobsService.findOne(tenantId, id);
  }

  @Post()
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  create(
    @CurrentTenant() tenantId: string,
    @Body()
    body: {
      vendorId: string;
      title: string;
      description: string;
      skills?: string[];
      location?: string;
      locationType?: string;
      rateMin?: number;
      rateMax?: number;
      rateType?: string;
      startDate?: string;
      durationMonths?: number;
    },
  ) {
    return this.jobsService.create(tenantId, body);
  }

  @Post('intake')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  intake(
    @CurrentTenant() tenantId: string,
    @Body() body: { rawText: string; vendorId: string; sourceEmail?: string },
  ) {
    return this.jobsService.intake(tenantId, body);
  }

  @Patch(':id')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body()
    body: {
      title?: string;
      description?: string;
      skills?: string[];
      location?: string;
      locationType?: string;
      rateMin?: number;
      rateMax?: number;
      rateType?: string;
      startDate?: string;
      durationMonths?: number;
      status?: string;
    },
  ) {
    return this.jobsService.update(tenantId, id, body);
  }

  @Get(':id/candidates')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  findCandidateMatches(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.jobsService.findCandidateMatches(tenantId, id);
  }

  @Delete(':id')
  @Roles('MANAGEMENT')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.jobsService.remove(tenantId, id);
  }
}
