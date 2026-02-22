import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_INTERCEPTOR } from '@nestjs/core';
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
import { AuditInterceptor } from './common/audit.interceptor';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
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
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(TenantMiddleware).forRoutes('*');
  }
}
