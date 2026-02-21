import type { RateLimits } from "./types.js";

interface WindowEntry {
  timestamp: number;
}

interface RateLimitCheck {
  allowed: boolean;
  retryAfterMs?: number;
}

export class RateLimiter {
  private windows = new Map<string, WindowEntry[]>();
  private limits = new Map<string, RateLimits>();

  configure(agentId: string, limits: RateLimits): void {
    this.limits.set(agentId, limits);
  }

  check(agentId: string): RateLimitCheck {
    const limits = this.limits.get(agentId);
    if (!limits) {
      return { allowed: true };
    }

    const now = Date.now();
    const entries = this.getEntries(agentId, now);

    const oneMinuteAgo = now - 60_000;
    const oneHourAgo = now - 3_600_000;
    const oneDayAgo = now - 86_400_000;

    const minuteCount = entries.filter((e) => e.timestamp > oneMinuteAgo).length;
    if (minuteCount >= limits.perMinute) {
      const oldest = entries.find((e) => e.timestamp > oneMinuteAgo);
      const retryAfterMs = oldest ? oldest.timestamp - oneMinuteAgo : 60_000;
      return { allowed: false, retryAfterMs };
    }

    const hourCount = entries.filter((e) => e.timestamp > oneHourAgo).length;
    if (hourCount >= limits.perHour) {
      const oldest = entries.find((e) => e.timestamp > oneHourAgo);
      const retryAfterMs = oldest ? oldest.timestamp - oneHourAgo : 3_600_000;
      return { allowed: false, retryAfterMs };
    }

    const dayCount = entries.filter((e) => e.timestamp > oneDayAgo).length;
    if (dayCount >= limits.daily) {
      const oldest = entries.find((e) => e.timestamp > oneDayAgo);
      const retryAfterMs = oldest ? oldest.timestamp - oneDayAgo : 86_400_000;
      return { allowed: false, retryAfterMs };
    }

    return { allowed: true };
  }

  record(agentId: string): void {
    const entries = this.windows.get(agentId) ?? [];
    entries.push({ timestamp: Date.now() });
    this.windows.set(agentId, entries);
  }

  reset(agentId: string): void {
    this.windows.delete(agentId);
  }

  private getEntries(agentId: string, now: number): WindowEntry[] {
    const entries = this.windows.get(agentId) ?? [];
    const oneDayAgo = now - 86_400_000;
    const active = entries.filter((e) => e.timestamp > oneDayAgo);
    this.windows.set(agentId, active);
    return active;
  }
}
