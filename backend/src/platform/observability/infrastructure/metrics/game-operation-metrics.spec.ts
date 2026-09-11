import { Registry } from '@prometheus-io/client';
import { GameOperationMetrics } from './game-operation-metrics';

it('exports stable error dimensions without messages, player IDs or unbounded labels', async () => {
  const registry = new Registry();
  const metrics = new GameOperationMetrics(registry);
  metrics.recordFailure('lama', 'RESOURCE_INSUFFICIENT', 'command');
  metrics.recordFailure('lama', 'INTERNAL_ERROR', 'restore');
  metrics.recordFailure('lama', 'INTERNAL_ERROR', 'snapshot');
  metrics.recordFailure(
    'private@example.com',
    'secret exception text',
    'replay',
  );
  for (let index = 0; index < 2000; index++)
    metrics.recordFailure(`game-${index}`, `ERROR_${index}`, 'command');
  const output = await registry.metrics();
  expect(output).toContain(
    'game="lama",code="RESOURCE_INSUFFICIENT",operation="command"',
  );
  expect(output).toContain('operation="restore"');
  expect(output).toContain('operation="snapshot"');
  expect(output).not.toContain('private@example.com');
  expect(output).not.toContain('secret exception text');
  expect(
    new Set([...output.matchAll(/game="([^"]+)"/g)].map((m) => m[1])).size,
  ).toBeLessThanOrEqual(129);
  expect(
    new Set([...output.matchAll(/code="([^"]+)"/g)].map((m) => m[1])).size,
  ).toBeLessThanOrEqual(65);
});
