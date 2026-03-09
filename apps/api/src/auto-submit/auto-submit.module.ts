import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { SubmissionsModule } from '../submissions/submissions.module';
import { AutoSubmitController } from './auto-submit.controller';
import { AutoSubmitService } from './auto-submit.service';

@Module({
  imports: [ScheduleModule.forRoot(), SubmissionsModule],
  controllers: [AutoSubmitController],
  providers: [AutoSubmitService],
  exports: [AutoSubmitService],
})
export class AutoSubmitModule {}
