import { Module } from '@nestjs/common';
import { AiAgentsController } from './ai-agents.controller';
import { AiAgentsService } from './ai-agents.service';
import { StrategyResearchService } from './strategy-research.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AiAgentsController],
  providers: [AiAgentsService, StrategyResearchService],
  exports: [AiAgentsService, StrategyResearchService],
})
export class AiAgentsModule {}
