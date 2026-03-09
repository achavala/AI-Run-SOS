import { Module } from '@nestjs/common';
import { StrategyOpsService } from './strategy-ops.service';
import { StrategyOpsController } from './strategy-ops.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StrategyOpsController],
  providers: [StrategyOpsService],
  exports: [StrategyOpsService],
})
export class StrategyOpsModule {}
