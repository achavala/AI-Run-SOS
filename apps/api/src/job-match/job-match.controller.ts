import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  Param,
  Res,
  Sse,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
  MessageEvent,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { Observable, Subject, map, interval, takeWhile, finalize } from 'rxjs';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/tenant.decorator';
import { CurrentUser } from '../common/user.decorator';
import { Throttle } from '@nestjs/throttler';
import { JobMatchService } from './job-match.service';

@Controller('job-match')
@UseGuards(JwtAuthGuard, RolesGuard)
export class JobMatchController {
  constructor(private svc: JobMatchService) {}

  /* ── Match consultants to a job (trigger + return) ────── */

  @Post('match-to-job')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  matchConsultantsToJob(
    @CurrentTenant() tenantId: string,
    @Body() body: { jobId: string; jobType: 'internal' | 'market' },
  ) {
    return this.svc.matchConsultantsToJob(tenantId, body.jobId, body.jobType);
  }

  /* ── GET match data for a job (trigger + return enriched) */

  @Get('for-job')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  async getMatchesForJob(
    @CurrentTenant() tenantId: string,
    @Query('jobId') jobId?: string,
    @Query('marketJobId') marketJobId?: string,
    @Query('limit') limit?: string,
  ) {
    const resolvedId = marketJobId || jobId;
    const jobType: 'internal' | 'market' = marketJobId ? 'market' : 'internal';
    if (!resolvedId) throw new BadRequestException('jobId or marketJobId required');
    await this.svc.matchConsultantsToJob(tenantId, resolvedId, jobType);
    return this.svc.getJobMatchDetails(tenantId, resolvedId, jobType, limit ? parseInt(limit, 10) : 30);
  }

  /* ── Match jobs to a consultant ────────────────────────── */

  @Get('for-consultant/:id')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  matchJobsToConsultant(
    @CurrentTenant() tenantId: string,
    @Param('id') consultantId: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.matchJobsToConsultant(
      tenantId,
      consultantId,
      limit ? parseInt(limit, 10) : 10,
    );
  }

  /* ── Generate optimized resume (rate-limited: 10 per minute) ── */

  @Post('generate-resume')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  generateOptimizedResume(
    @CurrentTenant() tenantId: string,
    @Body()
    body: {
      consultantId: string;
      jobId: string;
      jobType: 'internal' | 'market';
    },
  ) {
    return this.svc.generateOptimizedResume(
      tenantId,
      body.consultantId,
      body.jobId,
      body.jobType,
    );
  }

  /* ── Submit consultant (rate-limited: 5 per minute) ────── */

  @Post('submit')
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  submitConsultant(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      consultantId: string;
      jobId: string;
      jobType: 'internal' | 'market';
      resumeArtifactId?: string;
      notes?: string;
    },
  ) {
    return this.svc.submitConsultant(tenantId, userId, body);
  }

  /* ── Serve resume HTML from DB ───────────────────────── */

  @Get('resume/:id/html')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  async serveResumeHtml(
    @CurrentTenant() tenantId: string,
    @Param('id') artifactId: string,
    @Res() res: Response,
  ) {
    const html = await this.svc.getResumeHtml(tenantId, artifactId);
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  }

  /* ── Upload real resume for a consultant ─────────────── */

  @Post('upload-resume')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadResume(
    @CurrentTenant() tenantId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { consultantId: string; version?: string },
  ) {
    if (!file) throw new BadRequestException('No file uploaded');
    return this.svc.uploadResume(tenantId, body.consultantId, file, body.version);
  }

  /* ── Handle approval (public — no auth guard for email links) ── */

  @Get('approval/:token')
  handleApproval(
    @Param('token') token: string,
    @Query('approved') approved: string,
    @Query('note') note?: string,
  ) {
    return this.svc.handleApproval(
      token,
      approved === 'true',
      note,
    );
  }

  /* ── Get job match details ─────────────────────────────── */

  @Get('job-details')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  getJobMatchDetails(
    @CurrentTenant() tenantId: string,
    @Query('jobId') jobId: string,
    @Query('jobType') jobType: 'internal' | 'market',
  ) {
    return this.svc.getJobMatchDetails(tenantId, jobId, jobType);
  }

  /* ── Get consultant match details ──────────────────────── */

  @Get('consultant-details/:id')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT', 'SALES')
  getConsultantMatchDetails(
    @CurrentTenant() tenantId: string,
    @Param('id') consultantId: string,
  ) {
    return this.svc.getConsultantMatchDetails(tenantId, consultantId);
  }

  /* ── SSE: resume generation progress ──────────────────── */

  @Post('generate-resume-async')
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  async generateResumeAsync(
    @CurrentTenant() tenantId: string,
    @Body()
    body: {
      consultantId: string;
      jobId: string;
      jobType: 'internal' | 'market';
    },
  ) {
    const taskId = `resume-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    this.svc.trackResumeGeneration(taskId, 'queued');

    this.svc
      .generateOptimizedResume(tenantId, body.consultantId, body.jobId, body.jobType)
      .then((result) => this.svc.trackResumeGeneration(taskId, 'complete', result))
      .catch((err) => this.svc.trackResumeGeneration(taskId, 'error', { error: err.message }));

    this.svc.trackResumeGeneration(taskId, 'generating');
    return { taskId, status: 'generating' };
  }

  @Sse('generate-resume-progress/:taskId')
  resumeProgress(@Param('taskId') taskId: string): Observable<MessageEvent> {
    return interval(500).pipe(
      map(() => {
        const status = this.svc.getResumeGenerationStatus(taskId);
        return { data: status } as MessageEvent;
      }),
      takeWhile((event) => {
        const s = (event.data as any)?.status;
        return s !== 'complete' && s !== 'error' && s !== 'not_found';
      }, true),
    );
  }

  /* ── Admin: clean fake seed data ─────────────────────── */

  @Post('admin/clean-seed-data')
  @Roles('SUPERADMIN')
  cleanSeedData(@CurrentTenant() tenantId: string) {
    return this.svc.cleanFakeSeedData(tenantId);
  }
}
