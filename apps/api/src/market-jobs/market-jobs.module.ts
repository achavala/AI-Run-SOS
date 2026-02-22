import { Module } from '@nestjs/common';
import { MarketJobsController } from './market-jobs.controller';
import { MarketJobsService } from './market-jobs.service';

@Module({
  controllers: [MarketJobsController],
  providers: [MarketJobsService],
  exports: [MarketJobsService],
})
export class MarketJobsModule {}
