import { Injectable, Logger } from '@nestjs/common';

export interface StructuredError {
  service: string;
  operation: string;
  message: string;
  stack?: string;
  context?: Record<string, any>;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

@Injectable()
export class ErrorReporterService {
  private readonly logger = new Logger('ErrorReporter');
  private readonly recentErrors: (StructuredError & { timestamp: string })[] = [];
  private readonly MAX_RECENT = 200;

  report(error: StructuredError): void {
    const entry = {
      ...error,
      timestamp: new Date().toISOString(),
    };

    this.recentErrors.unshift(entry);
    if (this.recentErrors.length > this.MAX_RECENT) {
      this.recentErrors.length = this.MAX_RECENT;
    }

    const logLine = JSON.stringify({
      level: error.severity,
      service: error.service,
      operation: error.operation,
      message: error.message,
      ...error.context,
    });

    if (error.severity === 'critical' || error.severity === 'high') {
      this.logger.error(logLine, error.stack);
    } else if (error.severity === 'medium') {
      this.logger.warn(logLine);
    } else {
      this.logger.log(logLine);
    }
  }

  getRecentErrors(limit = 50): (StructuredError & { timestamp: string })[] {
    return this.recentErrors.slice(0, limit);
  }

  getErrorCounts(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const e of this.recentErrors) {
      const key = `${e.service}:${e.operation}`;
      counts[key] = (counts[key] ?? 0) + 1;
    }
    return counts;
  }
}
