import { Module } from '@nestjs/common';
import { MarginGuardModule } from '../margin-guard/margin-guard.module';
import { OffersController } from './offers.controller';
import { OffersService } from './offers.service';

@Module({
  imports: [MarginGuardModule],
  controllers: [OffersController],
  providers: [OffersService],
  exports: [OffersService],
})
export class OffersModule {}
