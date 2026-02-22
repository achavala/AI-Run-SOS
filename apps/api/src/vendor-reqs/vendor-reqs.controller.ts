import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/tenant.decorator';
import { VendorReqsService } from './vendor-reqs.service';

@Controller('vendor-reqs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class VendorReqsController {
  constructor(private vendorReqsService: VendorReqsService) {}

  @Get()
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  findAll(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('vendorId') vendorId?: string,
    @Query('employmentType') employmentType?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ) {
    return this.vendorReqsService.findAll(tenantId, {
      search,
      status,
      vendorId,
      employmentType,
      page: page ? parseInt(page, 10) : 1,
      pageSize: pageSize ? parseInt(pageSize, 10) : 25,
      sortBy,
      sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
    });
  }

  @Get('stats')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  getStats(@CurrentTenant() tenantId: string) {
    return this.vendorReqsService.getStats(tenantId);
  }

  @Get(':id')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  findOne(@Param('id') id: string) {
    return this.vendorReqsService.findOne(id);
  }

  @Patch(':id/status')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  updateStatus(@Param('id') id: string, @Body('status') status: string) {
    return this.vendorReqsService.updateStatus(id, status);
  }

  @Post(':id/convert')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  convertToReq(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { vendorId: string; pod?: string },
  ) {
    return this.vendorReqsService.convertToReq(id, tenantId, body);
  }
}
