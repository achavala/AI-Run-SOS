import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { MatchingService } from './matching.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AiController {
  constructor(private matchingService: MatchingService) {}

  @Post('match-consultants')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  matchConsultants(
    @Body() body: { skills: string[]; location?: string; limit?: number },
  ) {
    return this.matchingService.findMatchingConsultants(body);
  }

  @Get('vendor-trust-scores')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'SALES')
  getVendorTrustScores() {
    return this.matchingService.computeVendorTrustScores();
  }

  @Get('ranked-market-jobs')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  getRankedMarketJobs(
    @Query('pod') pod?: string,
    @Query('skills') skills?: string,
    @Query('limit') limit?: string,
  ) {
    const skillList = skills ? skills.split(',').map((s) => s.trim()) : [];
    return this.matchingService.rankMarketJobsForPod(
      pod ?? 'SWE',
      skillList,
      limit ? parseInt(limit, 10) : 50,
    );
  }
}
