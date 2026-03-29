import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { TenantMiddleware } from './auth/tenant.middleware';
import { VendorsModule } from './vendors/vendors.module';
import { ConsultantsModule } from './consultants/consultants.module';
import { JobsModule } from './jobs/jobs.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { TimesheetsModule } from './timesheets/timesheets.module';
import { InvoicesModule } from './invoices/invoices.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { OffersModule } from './offers/offers.module';
import { AssignmentsModule } from './assignments/assignments.module';
import { MarginGuardModule } from './margin-guard/margin-guard.module';
import { ScoreboardModule } from './scoreboard/scoreboard.module';
import { MarketJobsModule } from './market-jobs/market-jobs.module';
import { VendorReqsModule } from './vendor-reqs/vendor-reqs.module';
import { PstIntelModule } from './pst-intel/pst-intel.module';
import { AiModule } from './ai/ai.module';
import { MailIntelModule } from './mail-intel/mail-intel.module';
import { VendorTrustModule } from './vendor-trust/vendor-trust.module';
import { CommandCenterModule } from './command-center/command-center.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { AiAgentsModule } from './ai-agents/ai-agents.module';
import { EmailModule } from './email/email.module';
import { AutoSubmitModule } from './auto-submit/auto-submit.module';
import { ResumeFormatterModule } from './resume-formatter/resume-formatter.module';
import { StrategyOpsModule } from './strategy-ops/strategy-ops.module';
import { BenchSalesModule } from './bench-sales/bench-sales.module';
import { BenchIntakeModule } from './bench-intake/bench-intake.module';
import { JobMatchModule } from './job-match/job-match.module';
import { AuditInterceptor } from './common/audit.interceptor';
import { ErrorReporterService } from './common/error-reporter.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 60 }]),
    PrismaModule,
    EmailModule,
    AuthModule,
    VendorsModule,
    ConsultantsModule,
    JobsModule,
    SubmissionsModule,
    TimesheetsModule,
    InvoicesModule,
    DashboardModule,
    OffersModule,
    AssignmentsModule,
    MarginGuardModule,
    ScoreboardModule,
    MarketJobsModule,
    VendorReqsModule,
    PstIntelModule,
    AiModule,
    MailIntelModule,
    VendorTrustModule,
    CommandCenterModule,
    AnalyticsModule,
    AiAgentsModule,
    AutoSubmitModule,
    ResumeFormatterModule,
    StrategyOpsModule,
    BenchSalesModule,
    BenchIntakeModule,
    JobMatchModule,
  ],
  providers: [
    ErrorReporterService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [ErrorReporterService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
