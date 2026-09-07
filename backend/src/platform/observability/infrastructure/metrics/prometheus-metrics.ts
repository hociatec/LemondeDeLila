import type { NextFunction, Request, Response } from 'express';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from '@prometheus-io/client';

export class PrometheusMetrics {
  readonly registry = new Registry();
  private readonly requests = new Counter({
    name: 'lila_http_requests_total',
    help: 'Nombre de requêtes HTTP terminées.',
    labelNames: ['method', 'route', 'status'] as const,
    registers: [this.registry],
  });
  private readonly latency = new Histogram({
    name: 'lila_http_request_duration_seconds',
    help: 'Latence HTTP côté serveur.',
    labelNames: ['method', 'route', 'status'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });
  private readonly websocketMessages = new Counter({
    name: 'lila_ws_messages_total',
    help: 'Nombre de messages WebSocket traités.',
    labelNames: ['type', 'outcome'] as const,
    registers: [this.registry],
  });
  private readonly websocketLatency = new Histogram({
    name: 'lila_ws_message_duration_seconds',
    help: 'Latence des handlers WebSocket.',
    labelNames: ['type', 'outcome'] as const,
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
    registers: [this.registry],
  });
  private readonly dependencyUp = new Gauge({
    name: 'lila_dependency_up',
    help: 'Disponibilité instantanée des dépendances.',
    labelNames: ['dependency'] as const,
    registers: [this.registry],
  });
  private readonly dependencySaturation = new Gauge({
    name: 'lila_dependency_saturation_ratio',
    help: 'Ratio de saturation borné entre zéro et un.',
    labelNames: ['dependency', 'resource'] as const,
    registers: [this.registry],
  });
  private readonly bullmqJobs = new Gauge({
    name: 'lila_bullmq_jobs',
    help: 'Nombre de jobs BullMQ par état.',
    labelNames: ['queue', 'state'] as const,
    registers: [this.registry],
  });
  constructor() {
    collectDefaultMetrics({ prefix: 'lila_', register: this.registry });
  }

  middleware(request: Request, response: Response, next: NextFunction): void {
    const startedAt = process.hrtime.bigint();
    response.once('finish', () => {
      const routeValue: unknown = (request as Request & { route?: unknown })
        .route;
      const routePathValue =
        routeValue && typeof routeValue === 'object'
          ? (routeValue as Record<string, unknown>)['path']
          : null;
      const routePath =
        typeof routePathValue === 'string' ? routePathValue : '';
      const route = routePath ? `${request.baseUrl}${routePath}` : 'unmatched';
      const labels = {
        method: request.method,
        route,
        status: String(response.statusCode),
      };
      this.requests.inc(labels);
      this.latency.observe(
        labels,
        Number(process.hrtime.bigint() - startedAt) / 1_000_000_000,
      );
    });
    next();
  }

  recordWebSocket(
    type: string,
    outcome: 'success' | 'error' | 'rejected',
    durationSeconds: number,
  ): void {
    const labels = { type, outcome };
    this.websocketMessages.inc(labels);
    this.websocketLatency.observe(labels, Math.max(0, durationSeconds));
  }

  setDependencyUp(dependency: 'database' | 'redis' | 'bullmq', up: boolean) {
    this.dependencyUp.set({ dependency }, up ? 1 : 0);
  }

  setDependencySaturation(
    dependency: 'database' | 'redis' | 'bullmq',
    resource: string,
    ratio: number,
  ): void {
    this.dependencySaturation.set(
      { dependency, resource },
      Math.max(0, Math.min(1, ratio)),
    );
  }

  setBullmqJobs(
    queue: string,
    counts: Record<'waiting' | 'active' | 'delayed' | 'failed', number>,
  ): void {
    for (const [state, count] of Object.entries(counts)) {
      this.bullmqJobs.set({ queue, state }, count);
    }
  }
}

export const prometheusMetrics = new PrometheusMetrics();
