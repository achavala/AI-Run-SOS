import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { PrismaService } from '../prisma/prisma.service';

const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'adminPassword',
  'token',
  'secret',
  'accessToken',
]);

const MUTATION_METHODS = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  constructor(private prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user, ip, headers } = request;
    const start = Date.now();

    if (!MUTATION_METHODS.has(method)) {
      return next.handle();
    }

    const handler = context.getHandler();
    const controller = context.getClass();
    const action = `${controller.name}.${handler.name}`;

    return next.handle().pipe(
      tap((responseBody) => {
        const duration = Date.now() - start;
        const response = context.switchToHttp().getResponse();

        const entityId = this.extractEntityId(responseBody, body, url);
        const entityType = this.inferEntityType(url);

        const logEntry = {
          userId: user?.id ?? 'anonymous',
          tenantId: user?.tenantId ?? request.tenantId ?? 'unknown',
          method,
          path: url,
          statusCode: response.statusCode,
          durationMs: duration,
          action,
          entityType,
          entityId,
          ...(body ? { body: this.sanitize(body) } : {}),
        };

        this.logger.log(JSON.stringify(logEntry));

        this.persistAudit(
          user?.tenantId ?? request.tenantId,
          user?.id,
          action,
          entityType,
          entityId,
          logEntry,
          ip,
          headers?.['user-agent'],
        ).catch(() => {});
      }),
      catchError((err) => {
        const duration = Date.now() - start;
        this.logger.warn(
          JSON.stringify({
            userId: user?.id ?? 'anonymous',
            tenantId: user?.tenantId ?? request.tenantId ?? 'unknown',
            method,
            path: url,
            durationMs: duration,
            action,
            error: err.message,
          }),
        );
        throw err;
      }),
    );
  }

  private async persistAudit(
    tenantId: string | undefined,
    userId: string | undefined,
    action: string,
    entityType: string,
    entityId: string | null,
    metadata: Record<string, any>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    if (!tenantId) return;
    try {
      await this.prisma.auditLog.create({
        data: {
          tenantId,
          userId: userId ?? null,
          action,
          entityType,
          entityId,
          metadata: metadata as any,
          ipAddress: ipAddress ?? null,
          userAgent: userAgent?.slice(0, 500) ?? null,
        },
      });
    } catch (err: any) {
      this.logger.warn(`Failed to persist audit log: ${err.message}`);
    }
  }

  private extractEntityId(responseBody: any, requestBody: any, url: string): string | null {
    if (responseBody?.id) return responseBody.id;
    if (responseBody?.submissionId) return responseBody.submissionId;
    if (responseBody?.approvalId) return responseBody.approvalId;
    if (requestBody?.consultantId) return requestBody.consultantId;
    if (requestBody?.jobId) return requestBody.jobId;
    const urlMatch = url.match(/\/([a-z0-9]{20,})/i);
    return urlMatch?.[1] ?? null;
  }

  private inferEntityType(url: string): string {
    if (url.includes('/job-match/submit')) return 'submission';
    if (url.includes('/job-match/generate-resume')) return 'resume_generation';
    if (url.includes('/job-match/upload-resume')) return 'resume_upload';
    if (url.includes('/submissions')) return 'submission';
    if (url.includes('/consultants')) return 'consultant';
    if (url.includes('/vendors')) return 'vendor';
    if (url.includes('/jobs')) return 'job';
    if (url.includes('/invoices')) return 'invoice';
    if (url.includes('/timesheets')) return 'timesheet';
    if (url.includes('/offers')) return 'offer';
    if (url.includes('/assignments')) return 'assignment';
    const segment = url.split('/').filter(Boolean)[1] ?? 'unknown';
    return segment;
  }

  private sanitize(body: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      out[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value;
    }
    return out;
  }
}
