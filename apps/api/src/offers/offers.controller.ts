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
import { OffersService } from './offers.service';

@Controller('offers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class OffersController {
  constructor(private offersService: OffersService) {}

  @Get()
  @Roles('MANAGEMENT', 'SALES', 'RECRUITMENT')
  findAll(@CurrentTenant() tenantId: string) {
    return this.offersService.findAll(tenantId);
  }

  @Get(':id')
  findOne(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.offersService.findOne(tenantId, id);
  }

  @Post()
  @Roles('MANAGEMENT', 'SALES', 'RECRUITMENT')
  create(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: string,
    @Body()
    body: {
      submissionId: string;
      billRate: number;
      payRate: number;
      startDate: string;
      endDate: string;
      overrideMargin?: boolean;
      vendorCutPct?: number;
      burdenPct?: number;
      payrollTaxPct?: number;
      portalFeePct?: number;
      otherFees?: number;
      notes?: string;
    },
  ) {
    return this.offersService.create(tenantId, userId, userRole, body);
  }

  @Patch(':id/status')
  @Roles('MANAGEMENT', 'SALES', 'RECRUITMENT')
  updateStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Body() body: { status: 'ACCEPTED' | 'DECLINED' | 'WITHDRAWN'; notes?: string },
  ) {
    return this.offersService.updateStatus(tenantId, id, body);
  }

  @Delete(':id')
  @Roles('MANAGEMENT')
  remove(@CurrentTenant() tenantId: string, @Param('id') id: string) {
    return this.offersService.remove(tenantId, id);
  }
}
