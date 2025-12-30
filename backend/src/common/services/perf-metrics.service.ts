import { Injectable } from '@nestjs/common';
import { playingLog } from '../utils/playing-logger';

type PerfEntry = {
  ts: number;
  ms: number;
  meta?: Record<string, unknown>;
};

export type PerfEventSnapshot = {
  event: string;
  count: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  clientToServerCount: number;
  clientToServerAvgMs: number | null;
  clientToServerP95Ms: number | null;
  clientToServerMaxMs: number | null;
  lastMs: number | null;
  lastAt: string | null;
};

export type PerfSnapshot = {
  generatedAt: string;
  windowSeconds: number;
  events: PerfEventSnapshot[];
};

function nowMs(): number {
  // Monotonic-ish; good enough for duration.
  return Number(process.hrtime.bigint() / 1_000_000n);
}

function clampWindowSeconds(raw: unknown, fallback: number): number {
  const value = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(value)) return fallback;
  const n = Math.floor(value);
  if (n < 5) return 5;
  if (n > 3600) return 3600;
  return n;
}

function quantile95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95) - 1);
  return sorted[Math.max(0, idx)];
}

@Injectable()
export class PerfMetricsService {
  private readonly maxEntriesPerEvent = 500;
  private readonly buffers = new Map<string, PerfEntry[]>();

  async measure<T>(
    event: string,
    fn: () => Promise<T>,
    meta?: Record<string, unknown>,
  ): Promise<T> {
    const start = nowMs();
    try {
      return await fn();
    } finally {
      const ms = Math.max(0, nowMs() - start);
      this.record(event, ms, meta);
    }
  }

  record(event: string, ms: number, meta?: Record<string, unknown>): void {
    if (!event) return;
    const entry: PerfEntry = { ts: Date.now(), ms: Math.max(0, ms), meta };
    const list = this.buffers.get(event) ?? [];
    list.push(entry);
    if (list.length > this.maxEntriesPerEvent) {
      list.splice(0, list.length - this.maxEntriesPerEvent);
    }
    this.buffers.set(event, list);

    // Visible in server logs (admin can filter by "perf.sample").
    // Avoid spamming: only keep slow samples.
    if (entry.ms >= 250) {
      playingLog('perf.sample', {
        event,
        ms: entry.ms,
        ...meta,
      });
    }
  }

  snapshot(options?: { windowSeconds?: number }): PerfSnapshot {
    const windowSeconds = clampWindowSeconds(options?.windowSeconds, 300);
    const since = Date.now() - windowSeconds * 1000;

    const events: PerfEventSnapshot[] = [];
    for (const [event, entries] of this.buffers.entries()) {
      const recent = entries.filter((e) => e.ts >= since);
      if (recent.length === 0) continue;
      const values = recent.map((e) => e.ms);
      const c2sValues = recent
        .map((e) => (e.meta ? (e.meta['clientToServerMs'] as unknown) : null))
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      const count = values.length;
      const sum = values.reduce((a, b) => a + b, 0);
      const maxMs = values.reduce((a, b) => (b > a ? b : a), 0);
      const avgMs = count > 0 ? sum / count : 0;
      const p95Ms = quantile95(values);
      const c2sCount = c2sValues.length;
      const c2sSum = c2sValues.reduce((a, b) => a + b, 0);
      const c2sAvgMs = c2sCount > 0 ? c2sSum / c2sCount : null;
      const c2sP95Ms = c2sCount > 0 ? quantile95(c2sValues) : null;
      const c2sMaxMs =
        c2sCount > 0 ? c2sValues.reduce((a, b) => (b > a ? b : a), 0) : null;
      const last = recent[recent.length - 1];
      events.push({
        event,
        count,
        avgMs,
        p95Ms,
        maxMs,
        clientToServerCount: c2sCount,
        clientToServerAvgMs: c2sAvgMs,
        clientToServerP95Ms: c2sP95Ms,
        clientToServerMaxMs: c2sMaxMs,
        lastMs: last?.ms ?? null,
        lastAt: last ? new Date(last.ts).toISOString() : null,
      });
    }

    events.sort((a, b) => b.p95Ms - a.p95Ms);

    return {
      generatedAt: new Date().toISOString(),
      windowSeconds,
      events,
    };
  }
}
