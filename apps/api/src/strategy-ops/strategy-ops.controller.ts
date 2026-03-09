import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { StrategyOpsService } from './strategy-ops.service';
import { CurrentTenant } from '../common/tenant.decorator';

@Controller('strategy-ops')
export class StrategyOpsController {
  constructor(private readonly strategyOps: StrategyOpsService) {}

  @Get('overview')
  getStrategicOverview(@CurrentTenant() tenantId: string) {
    return this.strategyOps.getStrategicOverview(tenantId);
  }

  @Get('supply-demand')
  getSupplyDemandMatrix() {
    return this.strategyOps.getSupplyDemandMatrix();
  }

  @Get('tech-tiers')
  getTechTiers() {
    return this.strategyOps.getTechTiers();
  }

  @Get('reqs-by-family')
  getReqsByFamily(
    @Query('family') family: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.strategyOps.getReqsByFamily(
      family,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 25,
    );
  }

  @Get('tech-tier-analytics')
  getTechTierAnalytics() {
    return this.strategyOps.getTechTierAnalytics();
  }

  @Get('lane-performance')
  getLanePerformance(@CurrentTenant() tenantId: string) {
    return this.strategyOps.getLanePerformance(tenantId);
  }

  @Get('opt-employers')
  getOptEmployers(@Query('page') page?: string, @Query('pageSize') pageSize?: string) {
    return this.strategyOps.getOptEmployers(
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 25,
    );
  }

  @Post('compute-quality-scores')
  computeCandidateQualityScores() {
    return this.strategyOps.computeCandidateQualityScores();
  }

  @Post('quality-gates')
  checkPreSubmissionGates(@Body() body: {
    vendorDomain?: string;
    billRate?: number;
    payRate?: number;
    consultantId: string;
    reqTitle: string;
    employmentType?: string;
  }) {
    return this.strategyOps.checkPreSubmissionGates(body);
  }

  @Post('tech-tiers')
  upsertTechTier(@Body() body: {
    technologyFamily: string;
    rank: number;
    premiumSkillFamily?: string;
    pod?: string;
    c2cBillRateMin?: number;
    c2cBillRateMax?: number;
    fteSalaryMin?: number;
    fteSalaryMax?: number;
    demandGrowthPct?: number;
    competitionLevel?: string;
    grossProfitPerPlacement?: number;
    portfolioAllocationPct?: number;
    keySkills?: string[];
    targetVendorTiers?: string[];
    sourcingStrategy?: string;
  }) {
    return this.strategyOps.upsertTechTier(body);
  }

  @Post('opt-employers')
  upsertOptEmployer(@Body() body: {
    companyName: string;
    website?: string;
    atsSource?: string;
    visaFriendliness?: number;
    juniorFitScore?: number;
    compensationTier?: string;
    roleFamilies?: string[];
    degreeAlignment?: string[];
    h1bSponsored?: boolean;
    optStemEligible?: boolean;
    avgStartingSalary?: number;
    notes?: string;
  }) {
    return this.strategyOps.upsertOptEmployer(body);
  }
}
