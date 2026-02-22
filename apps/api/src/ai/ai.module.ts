import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MatchingService } from './matching.service';
import { AiController } from './ai.controller';

@Module({
  imports: [PrismaModule],
  controllers: [AiController],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class AiModule {}
