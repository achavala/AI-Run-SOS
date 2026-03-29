import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/tenant.decorator';
import { BenchSalesService } from './bench-sales.service';

@Controller('bench-sales')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BenchSalesController {
  constructor(private svc: BenchSalesService) {}

  @Get('consultants')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  getConsultants(
    @CurrentTenant() tenantId: string,
    @Query('techCategory') techCategory?: string,
    @Query('search') search?: string,
    @Query('visa') visa?: string,
    @Query('location') location?: string,
    @Query('availability') availability?: string,
    @Query('minRate') minRate?: string,
    @Query('maxRate') maxRate?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.getConsultants(tenantId, {
      techCategory,
      search,
      visa,
      location,
      availability,
      minRate: minRate ? parseFloat(minRate) : undefined,
      maxRate: maxRate ? parseFloat(maxRate) : undefined,
      sort: sort as any,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  @Get('consultants/:id')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  getConsultantDetail(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.svc.getConsultantDetail(tenantId, id);
  }

  @Get('consultants/:id/top-jobs')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  getTopJobs(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getTopJobsForConsultant(tenantId, id, limit ? parseInt(limit, 10) : 10);
  }

  @Get('tech-categories')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  getTechCategories() {
    return this.svc.getTechCategories();
  }
}
