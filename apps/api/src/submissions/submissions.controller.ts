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
import { CurrentUser } from '../common/user.decorator';
import { SubmissionsService } from './submissions.service';

@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private submissionsService: SubmissionsService) {}

  @Get()
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  findAll(@CurrentTenant() tenantId: string) {
    return this.submissionsService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES', 'CONSULTANT')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.submissionsService.findOne(tenantId, id);
  }

  @Post()
  @Roles('MANAGEMENT', 'RECRUITMENT')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      jobId: string;
      consultantId: string;
      resumeVersion?: string;
      rtrDocUrl?: string;
      notes?: string;
      rateCardId?: string;
      overrideMargin?: boolean;
    },
  ) {
    return this.submissionsService.create(tenantId, userId, body);
  }

  @Post(':id/consent')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'CONSULTANT')
  consent(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { approved: boolean; consultantId: string },
  ) {
    return this.submissionsService.consent(tenantId, id, body);
  }

  @Patch(':id/status')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { status: string; vendorFeedback?: string },
  ) {
    return this.submissionsService.updateStatus(tenantId, id, body);
  }

  @Delete(':id')
  @Roles('MANAGEMENT')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.submissionsService.remove(tenantId, id);
  }
}
