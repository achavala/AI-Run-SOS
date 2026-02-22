import { Module } from '@nestjs/common';
import { MarginGuardController } from './margin-guard.controller';
import { MarginGuardService } from './margin-guard.service';

@Module({
  controllers: [MarginGuardController],
  providers: [MarginGuardService],
  exports: [MarginGuardService],
})
export class MarginGuardModule {}
