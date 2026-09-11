import { GameEngineMetricsService } from './game-engine-metrics.service';

it('does not create metrics on reads and bounds process-local game cardinality', () => {
  const metrics = new GameEngineMetricsService();
  for (let index = 0; index < 2000; index++)
    expect(metrics.snapshot(`unknown-${index}`)).toEqual([]);
  expect(metrics.snapshot()).toEqual([]);
  for (let index = 0; index < 2000; index++)
    metrics.recordCommand(`game-${index}`, false, 1);
  expect(metrics.snapshot().length).toBeLessThanOrEqual(129);
  expect(
    metrics
      .snapshot()
      .reduce((total, item) => total + item.commandsRejected, 0),
  ).toBe(2000);
});
