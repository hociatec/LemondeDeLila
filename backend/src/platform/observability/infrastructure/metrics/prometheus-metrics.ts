import type { NextFunction, Request, Response } from 'express';
import { GameOperationMetrics } from './game-operation-metrics';
import { BoundedMetricLabel } from './bounded-metric-label';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from '@prometheus-io/client';

export class PrometheusMetrics {
  readonly registry = new Registry();
  readonly game = new GameOperationMetrics(this.registry);
  private readonly routes = new BoundedMetricLabel(
    256,
    /^\/[\w/.:*{}?-]{0,255}$/,
  );
  private readonly wsTypes = new BoundedMetricLabel(
    256,
    /^[a-z][a-z0-9_.-]{0,127}$/,
  );
  private readonly resources = new BoundedMetricLabel(
    16,
    /^[a-z][a-z0-9_.-]{0,63}$/,
  );
  private readonly queues = new BoundedMetricLabel(
    16,
    /^[a-z][a-z0-9_.-]{0,127}$/,
  );
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
  private readonly activeRooms = new Gauge({
    name: 'lila_active_rooms',
    help: 'Nombre de salles avec au moins un joueur connecté.',
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
      const route = routePath
        ? this.routes.resolve(`${request.baseUrl}${routePath}`)
        : 'unmatched';
      const labels = {
        method: [
          'GET',
          'HEAD',
          'POST',
          'PUT',
          'PATCH',
          'DELETE',
          'OPTIONS',
          'CONNECT',
          'TRACE',
        ].includes(request.method)
          ? request.method
          : 'OTHER',
        route,
        status:
          Number.isInteger(response.statusCode) &&
          response.statusCode >= 100 &&
          response.statusCode <= 599
            ? String(response.statusCode)
            : 'unknown',
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
    const safeType = this.wsTypes.resolve(type);
    const labels = { type: safeType, outcome };
    this.websocketMessages.inc(labels);
    this.websocketLatency.observe(
      labels,
      Number.isFinite(durationSeconds)
        ? Math.min(86_400, Math.max(0, durationSeconds))
        : 0,
    );
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
      { dependency, resource: this.resources.resolve(resource) },
      Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0,
    );
  }

  setBullmqJobs(
    queue: string,
    counts: Record<'waiting' | 'active' | 'delayed' | 'failed', number>,
  ): void {
    queue = this.queues.resolve(queue);
    for (const state of ['waiting', 'active', 'delayed', 'failed'] as const) {
      const count = counts[state];
      this.bullmqJobs.set(
        { queue, state },
        Number.isFinite(count) && count >= 0 ? count : 0,
      );
    }
  }

  setActiveRooms(count: number): void {
    this.activeRooms.set(Number.isSafeInteger(count) && count >= 0 ? count : 0);
  }
}

export const prometheusMetrics = new PrometheusMetrics();
