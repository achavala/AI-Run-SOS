import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Query,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentTenant } from '../common/tenant.decorator';
import { CurrentUser } from '../common/user.decorator';
import { BenchIntakeService } from './bench-intake.service';

@Controller('bench-intake')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BenchIntakeController {
  constructor(private svc: BenchIntakeService) {}

  /* ── Add new consultant to bench with optional resume upload ── */

  @Post('add-consultant')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  @UseInterceptors(FileInterceptor('resume', { limits: { fileSize: 10 * 1024 * 1024 } }))
  addConsultant(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body()
    body: {
      firstName: string;
      lastName: string;
      email: string;
      phone?: string;
      skills?: string;
      visaType?: string;
      desiredRate?: string;
      availableFrom?: string;
    },
  ) {
    if (!body.firstName || !body.lastName || !body.email) {
      throw new BadRequestException('firstName, lastName, and email are required');
    }

    let skills: string[] = [];
    if (body.skills) {
      try {
        skills = JSON.parse(body.skills);
      } catch {
        skills = body.skills.split(',').map((s) => s.trim()).filter(Boolean);
      }
    }

    return this.svc.addConsultant(
      tenantId,
      {
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        phone: body.phone,
        skills,
        visaType: body.visaType,
        desiredRate: body.desiredRate ? parseFloat(body.desiredRate) : undefined,
        availableFrom: body.availableFrom,
      },
      userId,
      file || undefined,
    );
  }

  /* ── Parse resume and extract details ────────────────────── */

  @Post('parse-resume')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  @UseInterceptors(FileInterceptor('resume', { limits: { fileSize: 10 * 1024 * 1024 } }))
  parseResume(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('Resume file is required');
    return this.svc.parseResume(file);
  }

  /* ── List current bench consultants ──────────────────────── */

  @Get('current-bench')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  getCurrentBench(
    @CurrentTenant() tenantId: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.getCurrentBench(tenantId, {
      search,
      status,
      sort,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }

  /* ── Full consultant detail ──────────────────────────────── */

  @Get('consultant/:id')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  getConsultantDetail(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.svc.getConsultantDetail(tenantId, id);
  }

  /* ── AI pipeline status with per-step progress ───────────── */

  @Get('consultant/:id/ai-status')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  getAiStatus(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.svc.getAiStatus(tenantId, id);
  }

  /* ── Re-trigger AI pipeline ──────────────────────────────── */

  @Post('consultant/:id/trigger-ai')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  triggerAi(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.svc.triggerAi(tenantId, id);
  }

  /* ── Update consultant details (skills, contact, etc.) ──── */

  @Patch('consultant/:id')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  updateConsultant(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: {
      firstName?: string;
      lastName?: string;
      email?: string;
      phone?: string;
      skills?: string[];
      desiredRate?: number;
      availableFrom?: string;
    },
  ) {
    return this.svc.updateConsultant(tenantId, id, body, userId);
  }

  /* ── Upload resume to existing consultant ────────────────── */

  @Post('consultant/:id/upload-resume')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  @UseInterceptors(FileInterceptor('resume', { limits: { fileSize: 10 * 1024 * 1024 } }))
  uploadResume(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Resume file is required');
    return this.svc.uploadResume(tenantId, id, file, userId);
  }

  /* ── Update bench consultant status ──────────────────────── */

  @Patch('consultant/:id/status')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  updateStatus(
    @CurrentTenant() tenantId: string,
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    if (!body.status) throw new BadRequestException('status is required');
    return this.svc.updateStatus(tenantId, id, body.status, userId);
  }

  /* ── Activity timeline with pagination ───────────────────── */

  @Get('consultant/:id/activities')
  @Roles('MANAGEMENT', 'SUPERADMIN', 'RECRUITMENT')
  getActivities(
    @CurrentTenant() tenantId: string,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.getActivities(
      tenantId,
      id,
      page ? parseInt(page, 10) : 1,
      pageSize ? parseInt(pageSize, 10) : 20,
    );
  }
}
