import type { NextFunction, Request, Response } from 'express';
import {
  collectDefaultMetrics,
  Counter,
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
}

export const prometheusMetrics = new PrometheusMetrics();
