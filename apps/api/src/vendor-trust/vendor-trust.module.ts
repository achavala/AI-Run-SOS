import { Module } from '@nestjs/common';
import { VendorTrustController } from './vendor-trust.controller';
import { VendorTrustService } from './vendor-trust.service';

@Module({
  controllers: [VendorTrustController],
  providers: [VendorTrustService],
  exports: [VendorTrustService],
})
export class VendorTrustModule {}
