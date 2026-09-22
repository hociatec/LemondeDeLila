import { Registry } from '@prometheus-io/client';
import { DistributedLeaseMetrics } from './distributed-lease-metrics';

it('exports a zero-initialized, label-free loss counter', async () => {
  const registry = new Registry();
  const metrics = new DistributedLeaseMetrics(registry);
  expect(await registry.metrics()).toContain(
    'lila_distributed_lease_losses_total 0',
  );
  metrics.lose();
  metrics.lose();
  const text = await registry.metrics();
  expect(text).toContain('lila_distributed_lease_losses_total 2');
  expect(text).not.toMatch(/\{.*(?:key|token|room|user)/);
});
