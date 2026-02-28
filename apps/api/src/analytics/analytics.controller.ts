import { Controller, Get, Post, Patch, Query, Param, Body, Logger } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ApolloService } from './apollo.service';

@Controller('analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(
    private svc: AnalyticsService,
    private apollo: ApolloService,
  ) {}

  @Get('recruiter-activity')
  getRecruiterActivity() {
    return this.svc.getRecruiterActivity();
  }

  @Get('email-pipeline')
  getEmailPipeline() {
    return this.svc.getEmailPipeline();
  }

  @Get('email-quality')
  getEmailQualityAnalysis() {
    return this.svc.getEmailQualityAnalysis();
  }

  @Get('recruiter-efficiency')
  getRecruiterEfficiency() {
    return this.svc.getRecruiterEfficiencyTable();
  }

  @Get('actionable-queue')
  getActionableQueue(@Query('recruiter') recruiter?: string) {
    return this.svc.getActionableQueue(recruiter);
  }

  @Get('followups-due')
  getFollowupsDue() {
    return this.svc.getFollowupsDue();
  }

  @Get('closure-ranked-queue')
  getClosureRankedQueue(@Query('limit') limit?: string) {
    return this.svc.getClosureRankedQueue(limit ? parseInt(limit, 10) : 30);
  }

  @Get('recruiter-workload')
  getRecruiterWorkload() {
    return this.svc.getRecruiterWorkload();
  }

  @Post('auto-assign-queue')
  autoAssignQueue() {
    return this.svc.autoAssignQueue();
  }

  @Patch('queue-item/:id')
  updateQueueItem(@Param('id') id: string, @Body() body: { status: string }) {
    return this.svc.updateQueueItem(parseInt(id, 10), body.status);
  }

  @Get('vendor-feedback-loop')
  getVendorFeedbackLoop() {
    return this.svc.getVendorFeedbackLoop();
  }

  @Get('bench-readiness')
  getBenchReadiness() {
    return this.svc.computeBenchReadiness();
  }

  @Post('reconcile-consultants')
  reconcileConsultants() {
    return this.svc.reconcileConsultants('cmlx9kt5d0000pru4ltqxcjla');
  }

  @Post('import-email-submissions')
  importEmailSubmissions() {
    return this.svc.importEmailSubmissions('cmlx9kt5d0000pru4ltqxcjla');
  }

  @Post('populate-feedback-events')
  populateFeedbackEvents() {
    return this.svc.populateVendorFeedbackEvents();
  }

  @Post('capture-outcomes')
  captureOutcomes() {
    return this.svc.captureOutcomes('cmlx9kt5d0000pru4ltqxcjla');
  }

  @Post('vendor-reputation')
  computeVendorReputation() {
    return this.svc.computeVendorWhitelistBlacklist();
  }

  @Get('vendor-reputation')
  getVendorReputation() {
    return this.svc.computeVendorWhitelistBlacklist();
  }

  @Post('rate-intelligence')
  buildRateIntelligence() {
    return this.svc.buildRateIntelligence();
  }

  @Get('rate-intelligence')
  getRateIntelligence() {
    return this.svc.buildRateIntelligence();
  }

  @Post('skill-pod-assign')
  skillPodAssign() {
    return this.svc.autoAssignBySkillPod();
  }

  @Get('submission-templates')
  getSubmissionTemplates() {
    return this.svc.getSubmissionTemplates();
  }

  @Post('train-closure-model')
  trainClosureModel() {
    return this.svc.trainClosureModel();
  }

  @Get('closure-model')
  getClosureModel() {
    return this.svc.trainClosureModel();
  }

  @Post('apollo/enrich-top')
  enrichTopVendors(@Query('limit') limit?: string) {
    return this.apollo.enrichTopVendorContacts(limit ? parseInt(limit, 10) : 20);
  }

  @Post('apollo/discover/:domain')
  discoverContacts(@Param('domain') domain: string) {
    return this.apollo.discoverVendorContacts(domain);
  }

  @Post('apollo/enrich-email')
  enrichEmail(@Body() body: { email: string }) {
    return this.apollo.enrichEmail(body.email);
  }

  @Get('apollo/status')
  apolloStatus() {
    return { configured: this.apollo.isConfigured() };
  }

  @Get('live-feed')
  getLiveJobFeed(
    @Query('hours') hours?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.getLiveJobFeed(
      hours ? parseInt(hours, 10) : 24,
      limit ? parseInt(limit, 10) : 500,
      offset ? parseInt(offset, 10) : 0,
    );
  }

  @Get('high-paid-feed')
  getHighPaidFeed(
    @Query('minSalary') minSalary?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.getHighPaidFeed(
      minSalary ? parseInt(minSalary, 10) : 200_000,
      limit ? parseInt(limit, 10) : 300,
    );
  }

  @Post('crawl-faang')
  async crawlFaang() {
    this.logger.log('Manual FAANG/Tech career crawl triggered');
    return this.svc.crawlFaangCareers();
  }
}
