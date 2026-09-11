import type { NextFunction, Request, Response } from 'express';
import { prometheusMetrics, PrometheusMetrics } from './prometheus-metrics';

describe('PrometheusMetrics', () => {
  it('bounds distinct labels across repeated calls, rather than just their length', async () => {
    const metrics = new PrometheusMetrics();
    for (let index = 0; index < 300; index++) {
      metrics.recordWebSocket(`untrusted.${index}`, 'rejected', 0);
      metrics.setDependencySaturation('redis', `resource-${index}`, NaN);
      metrics.setBullmqJobs(`queue-${index}`, {
        waiting: 0,
        active: 0,
        delayed: 0,
        failed: 0,
      });
    }
    const output = await metrics.registry.metrics();
    expect(output.match(/^lila_ws_messages_total\{/gm)).toHaveLength(257);
    expect(output).toContain('type="unknown",outcome="rejected"} 44');
    expect(output.match(/^lila_dependency_saturation_ratio\{/gm)).toHaveLength(
      17,
    );
    expect(output.match(/^lila_bullmq_jobs\{/gm)).toHaveLength(68);
    expect(output).not.toContain('NaN');
    metrics.recordWebSocket('untrusted.0', 'rejected', 0);
    expect(await metrics.registry.metrics()).toContain(
      'type="untrusted.0",outcome="rejected"} 2',
    );
  });
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
    prometheusMetrics.setActiveRooms(3);

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
    expect(output).toContain('lila_active_rooms 3');
  });
});
