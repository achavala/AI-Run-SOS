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
import { TimesheetsService } from './timesheets.service';

@Controller('timesheets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TimesheetsController {
  constructor(private timesheetsService: TimesheetsService) {}

  @Get()
  @Roles('MANAGEMENT', 'ACCOUNTS', 'RECRUITMENT', 'CONSULTANT')
  findAll(@CurrentTenant() tenantId: string) {
    return this.timesheetsService.findAll(tenantId);
  }

  @Get(':id')
  @Roles('MANAGEMENT', 'ACCOUNTS', 'RECRUITMENT', 'CONSULTANT')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.timesheetsService.findOne(tenantId, id);
  }

  @Post()
  @Roles('MANAGEMENT', 'CONSULTANT', 'ACCOUNTS')
  create(
    @CurrentTenant() tenantId: string,
    @Body()
    body: {
      placementId: string;
      weekEnding: string;
      hoursRegular?: number;
      hoursOvertime?: number;
    },
  ) {
    return this.timesheetsService.create(tenantId, body);
  }

  @Patch(':id')
  @Roles('MANAGEMENT', 'CONSULTANT')
  update(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { hoursRegular?: number; hoursOvertime?: number },
  ) {
    return this.timesheetsService.update(tenantId, id, body);
  }

  @Post(':id/submit')
  @Roles('MANAGEMENT', 'CONSULTANT')
  submit(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.timesheetsService.submit(tenantId, id);
  }

  @Post(':id/approve')
  @Roles('MANAGEMENT', 'ACCOUNTS')
  approve(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: { status: 'APPROVED' | 'REJECTED'; notes?: string },
  ) {
    return this.timesheetsService.approve(tenantId, id, userId, body);
  }

  @Delete(':id')
  @Roles('MANAGEMENT')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.timesheetsService.remove(tenantId, id);
  }
}
