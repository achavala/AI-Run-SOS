import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordHash',
  'adminPassword',
  'token',
  'secret',
  'accessToken',
]);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger('AuditLog');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url, body, user } = request;
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const response = context.switchToHttp().getResponse();
        const duration = Date.now() - start;
        const isMutation = ['POST', 'PATCH', 'PUT', 'DELETE'].includes(method);

        this.logger.log(
          JSON.stringify({
            userId: user?.id ?? 'anonymous',
            tenantId: user?.tenantId ?? request.tenantId ?? 'unknown',
            method,
            path: url,
            statusCode: response.statusCode,
            durationMs: duration,
            ...(isMutation && body ? { body: this.sanitize(body) } : {}),
          }),
        );
      }),
    );
  }

  private sanitize(body: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [key, value] of Object.entries(body)) {
      out[key] = SENSITIVE_FIELDS.has(key) ? '[REDACTED]' : value;
    }
    return out;
  }
}
