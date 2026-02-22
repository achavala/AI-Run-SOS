import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/tenant.decorator';
import { ScoreboardService } from './scoreboard.service';

@Controller('scoreboard')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('MANAGEMENT')
export class ScoreboardController {
  constructor(private scoreboardService: ScoreboardService) {}

  @Get('today')
  async getToday(@CurrentTenant() tenantId: string) {
    await this.scoreboardService.refresh(tenantId);
    return this.scoreboardService.getToday(tenantId);
  }

  @Get('history')
  getHistory(
    @CurrentTenant() tenantId: string,
    @Query('days') days?: string,
  ) {
    return this.scoreboardService.getHistory(tenantId, parseInt(days ?? '30', 10));
  }

  @Post('refresh')
  refresh(@CurrentTenant() tenantId: string) {
    return this.scoreboardService.refresh(tenantId);
  }
}
