import { Module } from '@nestjs/common';
import { ResumeFormatterController } from './resume-formatter.controller';
import { ResumeFormatterService } from './resume-formatter.service';

@Module({
  controllers: [ResumeFormatterController],
  providers: [ResumeFormatterService],
  exports: [ResumeFormatterService],
})
export class ResumeFormatterModule {}
