import { Counter, type Registry } from '@prometheus-io/client';

export class DistributedLeaseMetrics {
  private readonly lost: Counter;
  constructor(registry: Registry) {
    this.lost = new Counter({
      name: 'lila_distributed_lease_losses_total',
      help: 'Unexpected lease losses, excluding explicit release and shutdown.',
      registers: [registry],
    });
  }
  lose(): void {
    this.lost.inc();
  }
}
