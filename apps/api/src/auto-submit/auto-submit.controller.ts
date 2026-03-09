import { Controller, Get, Post, Body, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AutoSubmitService } from './auto-submit.service';

@Controller('auto-submit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AutoSubmitController {
  constructor(private autoSubmitService: AutoSubmitService) {}

  @Get('queue')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  async getQueue(
    @Req() req: any,
    @Query('status') status?: string,
    @Query('lane') lane?: string,
    @Query('limit') limit?: string,
  ) {
    return this.autoSubmitService.getQueue(
      req.tenantId,
      status,
      lane,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('stats')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  async getStats(@Req() req: any) {
    return this.autoSubmitService.getQueueStats(req.tenantId);
  }

  @Post('approve')
  @Roles('MANAGEMENT', 'RECRUITMENT')
  async batchApprove(
    @Req() req: any,
    @Body() body: { itemIds: string[] },
  ) {
    return this.autoSubmitService.batchApprove(req.tenantId, body.itemIds, req.user.id);
  }

  @Post('reject')
  @Roles('MANAGEMENT', 'RECRUITMENT')
  async batchReject(
    @Req() req: any,
    @Body() body: { itemIds: string[] },
  ) {
    return this.autoSubmitService.batchReject(req.tenantId, body.itemIds, req.user.id);
  }

  @Post('generate')
  @Roles('MANAGEMENT')
  async generateQueue(@Req() req: any) {
    return this.autoSubmitService.triggerQueueBuild(req.tenantId);
  }
}
