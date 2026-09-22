import { Registry } from '@prometheus-io/client';
import { AutomationRecoveryMetrics } from './automation-recovery-metrics';

it('exports sweep progress, deferred sessions and fixed outcome labels', async () => {
  const registry = new Registry();
  const metrics = new AutomationRecoveryMetrics(registry);
  metrics.session('scheduled');
  metrics.session('failed');
  metrics.session('deferred');
  metrics.pass(0.25, 2);
  metrics.sweep();
  const text = await registry.metrics();
  expect(text).toContain(
    'lila_game_recovery_sessions_total{outcome="scheduled"} 1',
  );
  expect(text).toContain('lila_game_recovery_deferred_sessions 2');
  expect(text).toContain('lila_game_recovery_sweeps_total 1');
  expect(text).toContain('lila_game_recovery_pass_seconds_count 1');
  expect(text).not.toMatch(/roomId|userId|commandId/);
});
