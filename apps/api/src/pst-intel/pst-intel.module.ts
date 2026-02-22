import { Module } from '@nestjs/common';
import { PstIntelController } from './pst-intel.controller';
import { PstIntelService } from './pst-intel.service';

@Module({
  controllers: [PstIntelController],
  providers: [PstIntelService],
  exports: [PstIntelService],
})
export class PstIntelModule {}
