import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MarketJobsController } from './market-jobs.controller';
import { MarketJobsService } from './market-jobs.service';
import { JobBoardFetcherService } from './job-board-fetcher.service';

@Module({
  imports: [PrismaModule],
  controllers: [MarketJobsController],
  providers: [MarketJobsService, JobBoardFetcherService],
  exports: [MarketJobsService, JobBoardFetcherService],
})
export class MarketJobsModule {}
