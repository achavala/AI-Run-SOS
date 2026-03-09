import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ResumeFormatterService } from './resume-formatter.service';

@Controller('resumes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ResumeFormatterController {
  constructor(private resumeFormatterService: ResumeFormatterService) {}

  @Post('format')
  @Roles('MANAGEMENT', 'RECRUITMENT')
  async formatResume(
    @Req() req: any,
    @Body() body: { consultantId: string; rawContent: string; pod?: string },
  ) {
    return this.resumeFormatterService.formatAndStore(
      req.tenantId,
      body.consultantId,
      body.rawContent,
      body.pod,
    );
  }

  @Get(':consultantId/versions')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  async getVersions(@Req() req: any, @Param('consultantId') consultantId: string) {
    return this.resumeFormatterService.getVersions(req.tenantId, consultantId);
  }

  @Get(':consultantId/current/:versionType')
  @Roles('MANAGEMENT', 'RECRUITMENT', 'SALES')
  async getCurrentVersion(
    @Req() req: any,
    @Param('consultantId') consultantId: string,
    @Param('versionType') versionType: string,
  ) {
    return this.resumeFormatterService.getCurrentVersion(req.tenantId, consultantId, versionType);
  }
}
