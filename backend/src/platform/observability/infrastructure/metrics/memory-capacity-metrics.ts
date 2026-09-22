import { Counter, Gauge, type Registry } from '@prometheus-io/client';

type Resource = 'replay-receipts' | 'game-sessions';

export class MemoryCapacityMetrics {
  private readonly saturation: Gauge<'resource'>;
  private readonly refusals: Counter<'resource'>;

  constructor(registry: Registry) {
    this.saturation = new Gauge({
      name: 'lila_memory_capacity_ratio',
      help: 'Usage of bounded in-process authoritative stores.',
      labelNames: ['resource'],
      registers: [registry],
    });
    this.refusals = new Counter({
      name: 'lila_memory_capacity_refusals_total',
      help: 'New entries refused to preserve existing replay or session data.',
      labelNames: ['resource'],
      registers: [registry],
    });
  }

  usage(resource: Resource, size: number, capacity: number): void {
    this.saturation.set(
      { resource },
      Math.max(0, Math.min(1, size / capacity)),
    );
  }

  refused(resource: Resource): void {
    this.refusals.inc({ resource });
  }
}
