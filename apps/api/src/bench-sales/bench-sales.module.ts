import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { BenchSalesService } from './bench-sales.service';
import { BenchSalesController } from './bench-sales.controller';

@Module({
  imports: [PrismaModule],
  controllers: [BenchSalesController],
  providers: [BenchSalesService],
  exports: [BenchSalesService],
})
export class BenchSalesModule {}
