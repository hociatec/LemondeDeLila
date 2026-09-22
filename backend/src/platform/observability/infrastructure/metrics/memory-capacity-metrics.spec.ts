import { Registry } from '@prometheus-io/client';
import { MemoryCapacityMetrics } from './memory-capacity-metrics';

it('reports occupancy and refusals using resource names without dynamic identities', async () => {
  const registry = new Registry();
  const metrics = new MemoryCapacityMetrics(registry);
  metrics.usage('game-sessions', 10_000, 10_000);
  metrics.refused('game-sessions');
  metrics.usage('replay-receipts', 9_000, 10_000);
  const output = await registry.metrics();
  expect(output).toContain(
    'lila_memory_capacity_ratio{resource="game-sessions"} 1',
  );
  expect(output).toContain(
    'lila_memory_capacity_ratio{resource="replay-receipts"} 0.9',
  );
  expect(output).toContain(
    'lila_memory_capacity_refusals_total{resource="game-sessions"} 1',
  );
  metrics.usage('game-sessions', 0, 10_000);
  expect(await registry.metrics()).toContain(
    'lila_memory_capacity_ratio{resource="game-sessions"} 0',
  );
});
