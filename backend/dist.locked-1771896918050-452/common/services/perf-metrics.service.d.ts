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
export declare class PerfMetricsService {
    private readonly maxEntriesPerEvent;
    private readonly buffers;
    measure<T>(event: string, fn: () => Promise<T>, meta?: Record<string, unknown>): Promise<T>;
    record(event: string, ms: number, meta?: Record<string, unknown>): void;
    snapshot(options?: {
        windowSeconds?: number;
    }): PerfSnapshot;
}
