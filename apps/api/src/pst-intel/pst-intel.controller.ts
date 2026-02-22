import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PstIntelService } from './pst-intel.service';

@Controller('pst-intel')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PstIntelController {
  constructor(private pstIntelService: PstIntelService) {}

  @Get('overview')
  @Roles('MANAGEMENT', 'SUPERADMIN')
  getOverview() {
    return this.pstIntelService.getOverview();
  }

  @Get('vendors')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  getTopVendors(@Query('limit') limit?: string) {
    return this.pstIntelService.getTopVendors(limit ? parseInt(limit, 10) : 50);
  }

  @Get('contacts')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  getContacts(
    @Query('search') search?: string,
    @Query('vendorId') vendorId?: string,
    @Query('hasPhone') hasPhone?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.pstIntelService.getContacts({
      search,
      vendorId,
      hasPhone: hasPhone === 'true',
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
    });
  }

  @Get('consultants')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  getConsultants(
    @Query('search') search?: string,
    @Query('skill') skill?: string,
    @Query('sourceType') sourceType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.pstIntelService.getConsultants({
      search,
      skill,
      sourceType,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
    });
  }

  @Get('consultants/:id')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  getConsultantDetail(@Param('id') id: string) {
    return this.pstIntelService.getConsultantDetail(id);
  }

  @Get('req-signals')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  getReqSignals(
    @Query('search') search?: string,
    @Query('employmentType') employmentType?: string,
    @Query('vendorId') vendorId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.pstIntelService.getReqSignals({
      search,
      employmentType,
      vendorId,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
    });
  }

  @Get('skills')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  getSkills() {
    return this.pstIntelService.getSkillsDistribution();
  }
}
