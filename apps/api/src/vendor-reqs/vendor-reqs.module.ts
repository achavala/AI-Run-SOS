import { Module } from '@nestjs/common';
import { VendorReqsController } from './vendor-reqs.controller';
import { VendorReqsService } from './vendor-reqs.service';

@Module({
  controllers: [VendorReqsController],
  providers: [VendorReqsService],
  exports: [VendorReqsService],
})
export class VendorReqsModule {}
