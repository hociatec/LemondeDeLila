"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PerfMetricsService = void 0;
const common_1 = require("@nestjs/common");
const playing_logger_1 = require("../utils/playing-logger");
function nowMs() {
    return Number(process.hrtime.bigint() / 1000000n);
}
function clampWindowSeconds(raw, fallback) {
    const value = typeof raw === 'number' ? raw : Number(raw);
    if (!Number.isFinite(value))
        return fallback;
    const n = Math.floor(value);
    if (n < 5)
        return 5;
    if (n > 3600)
        return 3600;
    return n;
}
function quantile95(values) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95) - 1);
    return sorted[Math.max(0, idx)];
}
let PerfMetricsService = class PerfMetricsService {
    maxEntriesPerEvent = 500;
    buffers = new Map();
    async measure(event, fn, meta) {
        const start = nowMs();
        try {
            return await fn();
        }
        finally {
            const ms = Math.max(0, nowMs() - start);
            this.record(event, ms, meta);
        }
    }
    record(event, ms, meta) {
        if (!event)
            return;
        const entry = { ts: Date.now(), ms: Math.max(0, ms), meta };
        const list = this.buffers.get(event) ?? [];
        list.push(entry);
        if (list.length > this.maxEntriesPerEvent) {
            list.splice(0, list.length - this.maxEntriesPerEvent);
        }
        this.buffers.set(event, list);
        if (entry.ms >= 250) {
            (0, playing_logger_1.playingLog)('perf.sample', {
                event,
                ms: entry.ms,
                ...meta,
            });
        }
    }
    snapshot(options) {
        const windowSeconds = clampWindowSeconds(options?.windowSeconds, 300);
        const since = Date.now() - windowSeconds * 1000;
        const events = [];
        for (const [event, entries] of this.buffers.entries()) {
            const recent = entries.filter((e) => e.ts >= since);
            if (recent.length === 0)
                continue;
            const values = recent.map((e) => e.ms);
            const c2sValues = recent
                .map((e) => (e.meta ? e.meta['clientToServerMs'] : null))
                .filter((v) => typeof v === 'number' && Number.isFinite(v));
            const count = values.length;
            const sum = values.reduce((a, b) => a + b, 0);
            const maxMs = values.reduce((a, b) => (b > a ? b : a), 0);
            const avgMs = count > 0 ? sum / count : 0;
            const p95Ms = quantile95(values);
            const c2sCount = c2sValues.length;
            const c2sSum = c2sValues.reduce((a, b) => a + b, 0);
            const c2sAvgMs = c2sCount > 0 ? c2sSum / c2sCount : null;
            const c2sP95Ms = c2sCount > 0 ? quantile95(c2sValues) : null;
            const c2sMaxMs = c2sCount > 0 ? c2sValues.reduce((a, b) => (b > a ? b : a), 0) : null;
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
};
exports.PerfMetricsService = PerfMetricsService;
exports.PerfMetricsService = PerfMetricsService = __decorate([
    (0, common_1.Injectable)()
], PerfMetricsService);
//# sourceMappingURL=perf-metrics.service.js.map