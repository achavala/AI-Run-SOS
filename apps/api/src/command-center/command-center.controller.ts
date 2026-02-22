import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/tenant.decorator';
import { CommandCenterService } from './command-center.service';

@Controller('command-center')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CommandCenterController {
  constructor(private readonly svc: CommandCenterService) {}

  @Get('autopilot-plan')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  getAutopilotPlan(@CurrentTenant() tenantId: string) {
    return this.svc.getAutopilotPlan(tenantId);
  }

  @Post('compute-actionability')
  @Roles('MANAGEMENT')
  computeActionability() {
    return this.svc.computeActionabilityScores();
  }
}
