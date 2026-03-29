import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../prisma/prisma.module';
import { BenchIntakeService } from './bench-intake.service';
import { BenchIntakeController } from './bench-intake.controller';
import { AiPipelineService } from './ai-pipeline.service';

@Module({
  imports: [
    PrismaModule,
    MulterModule.register({ storage: undefined }),
  ],
  controllers: [BenchIntakeController],
  providers: [BenchIntakeService, AiPipelineService],
  exports: [BenchIntakeService],
})
export class BenchIntakeModule {}
