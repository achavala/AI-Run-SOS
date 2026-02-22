import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/tenant.decorator';
import { MarginGuardService, MarginInput } from './margin-guard.service';

@Controller('margin-guard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class MarginGuardController {
  constructor(private marginGuardService: MarginGuardService) {}

  @Post('compute')
  compute(@Body() body: MarginInput) {
    return this.marginGuardService.computeMargin(body);
  }

  @Post('rate-card')
  @Roles('MANAGEMENT', 'SALES', 'ACCOUNTS')
  createRateCard(
    @CurrentTenant() tenantId: string,
    @Body() body: MarginInput,
  ) {
    return this.marginGuardService.createRateCard(tenantId, body);
  }

  @Get('rate-card/:id')
  getRateCard(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.marginGuardService.getRateCard(tenantId, id);
  }
}
