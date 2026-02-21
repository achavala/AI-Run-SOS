import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/tenant.decorator';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get('command-center')
  @Roles('MANAGEMENT')
  getCommandCenter(@CurrentTenant() tenantId: string) {
    return this.dashboardService.getCommandCenter(tenantId);
  }

  @Get('recruitment')
  @Roles('MANAGEMENT', 'RECRUITMENT')
  getRecruitment(@CurrentTenant() tenantId: string) {
    return this.dashboardService.getRecruitment(tenantId);
  }

  @Get('sales')
  @Roles('MANAGEMENT', 'SALES')
  getSales(@CurrentTenant() tenantId: string) {
    return this.dashboardService.getSales(tenantId);
  }

  @Get('accounts')
  @Roles('MANAGEMENT', 'ACCOUNTS')
  getAccounts(@CurrentTenant() tenantId: string) {
    return this.dashboardService.getAccounts(tenantId);
  }
}
