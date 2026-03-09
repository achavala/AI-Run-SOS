import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { MarginGuardModule } from '../margin-guard/margin-guard.module';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { FollowupDispatcherService } from './followup-dispatcher.service';
import { ResponseDetectorService } from './response-detector.service';

@Module({
  imports: [ScheduleModule.forRoot(), MarginGuardModule],
  controllers: [SubmissionsController],
  providers: [SubmissionsService, FollowupDispatcherService, ResponseDetectorService],
  exports: [SubmissionsService],
})
export class SubmissionsModule {}
