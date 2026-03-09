import { Module, Global } from '@nestjs/common';
import { EmailSenderService } from './email-sender.service';

@Global()
@Module({
  providers: [EmailSenderService],
  exports: [EmailSenderService],
})
export class EmailModule {}
