import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/tenant.decorator';
import { MarketJobsService } from './market-jobs.service';

@Controller('market-jobs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MarketJobsController {
  constructor(private marketJobsService: MarketJobsService) {}

  @Get()
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  findAll(
    @Query('search') search?: string,
    @Query('employmentType') employmentType?: string,
    @Query('source') source?: string,
    @Query('locationType') locationType?: string,
    @Query('freshness') freshness?: string,
    @Query('minHourlyRate') minHourlyRate?: string,
    @Query('maxHourlyRate') maxHourlyRate?: string,
    @Query('minRealness') minRealness?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.marketJobsService.findAll({
      search,
      employmentType,
      source,
      locationType,
      freshness,
      minHourlyRate: minHourlyRate ? parseFloat(minHourlyRate) : undefined,
      maxHourlyRate: maxHourlyRate ? parseFloat(maxHourlyRate) : undefined,
      minRealness: minRealness ? parseInt(minRealness, 10) : undefined,
      status,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
      sortBy,
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
    });
  }

  @Get('stats')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  getStats() {
    return this.marketJobsService.getStats();
  }

  @Get(':id')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  findOne(@Param('id') id: string) {
    return this.marketJobsService.findOne(id);
  }

  @Post(':id/convert')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  convertToReq(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { vendorId: string; pod?: string; assignedTo?: string },
  ) {
    return this.marketJobsService.convertToReq(id, tenantId, body);
  }
}
