import type { NextFunction, Request, Response } from 'express';
import { prometheusMetrics } from './prometheus-metrics';

describe('PrometheusMetrics', () => {
  it('exports process and bounded HTTP RED metrics', async () => {
    let finish: (() => void) | undefined;
    const request = {
      method: 'GET',
      baseUrl: '/health',
      route: { path: '/ready' },
    } as Request;
    const response = {
      statusCode: 200,
      once: (_event: string, listener: () => void) => {
        finish = listener;
        return response;
      },
    } as unknown as Response;
    const next = jest.fn() as NextFunction;

    prometheusMetrics.middleware(request, response, next);
    finish?.();
    prometheusMetrics.recordWebSocket('room.get', 'success', 0.01);
    prometheusMetrics.setDependencyUp('database', true);
    prometheusMetrics.setDependencySaturation('database', 'pool', 2);
    prometheusMetrics.setBullmqJobs('game-engine-tasks', {
      waiting: 1,
      active: 2,
      delayed: 3,
      failed: 4,
    });

    const output = await prometheusMetrics.registry.metrics();
    expect(next).toHaveBeenCalledTimes(1);
    expect(output).toContain('lila_process_cpu_user_seconds_total');
    expect(output).toContain(
      'lila_http_requests_total{method="GET",route="/health/ready",status="200"}',
    );
    expect(output).not.toContain('query');
    expect(output).toContain(
      'lila_ws_messages_total{type="room.get",outcome="success"} 1',
    );
    expect(output).toContain('lila_dependency_up{dependency="database"} 1');
    expect(output).toContain(
      'lila_dependency_saturation_ratio{dependency="database",resource="pool"} 1',
    );
    expect(output).toContain(
      'lila_bullmq_jobs{queue="game-engine-tasks",state="failed"} 4',
    );
  });
});
