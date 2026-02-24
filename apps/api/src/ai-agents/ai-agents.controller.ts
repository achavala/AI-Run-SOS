import { Controller, Get, Headers } from '@nestjs/common';
import { AiAgentsService } from './ai-agents.service';
import { StrategyResearchService } from './strategy-research.service';

@Controller('ai-agents')
export class AiAgentsController {
  constructor(
    private svc: AiAgentsService,
    private strategy: StrategyResearchService,
  ) {}

  @Get('sales-strategist')
  runSalesStrategist() {
    return this.svc.runSalesStrategist();
  }

  @Get('recruiting-strategist')
  runRecruitingStrategist() {
    return this.svc.runRecruitingStrategist();
  }

  @Get('job-search-analyst')
  runJobSearchAnalyst() {
    return this.svc.runJobSearchAnalyst();
  }

  @Get('gm-strategist')
  runGmStrategist(@Headers('x-tenant-id') tenantId: string) {
    return this.svc.runGmStrategist(tenantId || '00000000-0000-0000-0000-000000000000');
  }

  @Get('managerial-coach')
  runManagerialCoach() {
    return this.svc.runManagerialCoach();
  }

  @Get('strategy-research')
  getStrategyResearch() {
    return this.strategy.getCloudResourcesStrategy();
  }
}
