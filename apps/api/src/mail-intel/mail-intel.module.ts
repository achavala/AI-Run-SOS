import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MailIntelController } from './mail-intel.controller';
import { MailIntelService } from './mail-intel.service';

@Module({
  imports: [PrismaModule],
  controllers: [MailIntelController],
  providers: [MailIntelService],
  exports: [MailIntelService],
})
export class MailIntelModule {}
