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
import { CurrentUser } from '../common/user.decorator';
import { SubmissionsService } from './submissions.service';

@Controller('submissions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubmissionsController {
  constructor(private submissionsService: SubmissionsService) {}

  @Get()
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('status') status?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.submissionsService.findAll(tenantId, { status, dateFrom, dateTo });
  }

  @Get('stats')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  getStats(@CurrentTenant() tenantId: string) {
    return this.submissionsService.getSubmissionStats(tenantId);
  }

  @Get('due-followups')
  @Roles('MANAGEMENT', 'RECRUITMENT')
  getDueFollowups() {
    return this.submissionsService.getDueFollowups();
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

  @Post('from-req-signal')
  @Roles('MANAGEMENT', 'RECRUITMENT')
  createFromReqSignal(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      reqSignalId: string;
      consultantId: string;
      notes?: string;
    },
  ) {
    return this.submissionsService.createFromReqSignal(tenantId, userId, body);
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

  @Post(':id/send')
  @Roles('MANAGEMENT', 'RECRUITMENT')
  send(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.submissionsService.send(tenantId, id, userId);
  }

  @Post('followups/:id/sent')
  @Roles('MANAGEMENT', 'RECRUITMENT')
  markFollowupSent(@Param('id') id: string) {
    return this.submissionsService.markFollowupSent(id);
  }

  @Patch(':id/status')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() body: { status: string; vendorFeedback?: string },
  ) {
    return this.submissionsService.updateStatus(tenantId, id, body, userId);
  }

  @Delete(':id')
  @Roles('MANAGEMENT')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.submissionsService.remove(tenantId, id);
  }
}
