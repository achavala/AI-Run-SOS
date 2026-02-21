import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const payloadSegment = token.split('.')[1];
        if (payloadSegment) {
          const payload = JSON.parse(
            Buffer.from(payloadSegment, 'base64').toString('utf-8'),
          );
          (req as any).tenantId = payload.tenantId;
        }
      } catch {
        // JWT guard handles real validation; we just extract tenantId early
      }
    }
    next();
  }
}
