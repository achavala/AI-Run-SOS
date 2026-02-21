import type { AuditEntry } from "./types.js";

interface AuditFilter {
  agentId?: string;
  tenantId?: string;
  workflowId?: string;
}

export class AuditLogger {
  private buffer: AuditEntry[] = [];
  private flushedEntries: AuditEntry[] = [];

  log(entry: AuditEntry): void {
    Object.freeze(entry);
    this.buffer.push(entry);
  }

  flush(): AuditEntry[] {
    const flushed = [...this.buffer];
    this.flushedEntries.push(...flushed);
    this.buffer = [];
    return flushed;
  }

  getEntries(filter?: AuditFilter): AuditEntry[] {
    const all = [...this.flushedEntries, ...this.buffer];

    if (!filter) {
      return all;
    }

    return all.filter((entry) => {
      if (filter.agentId && entry.agentId !== filter.agentId) return false;
      if (filter.tenantId && entry.tenantId !== filter.tenantId) return false;
      if (filter.workflowId && entry.workflowId !== filter.workflowId) return false;
      return true;
    });
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  getTotalEntries(): number {
    return this.flushedEntries.length + this.buffer.length;
  }
}
