import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailModule } from '../email/email.module';
import { JobMatchService } from './job-match.service';
import { JobMatchController } from './job-match.controller';

@Module({
  imports: [
    PrismaModule,
    EmailModule,
    MulterModule.register({ storage: undefined }),
  ],
  controllers: [JobMatchController],
  providers: [JobMatchService],
  exports: [JobMatchService],
})
export class JobMatchModule {}
