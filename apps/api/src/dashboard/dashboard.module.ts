import { Module } from '@nestjs/common';
import { ScoreboardModule } from '../scoreboard/scoreboard.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [ScoreboardModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
