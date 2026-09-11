import { Logger } from '@nestjs/common';
import { mkdirSync, writeFileSync } from 'node:fs';
import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import { runGameReplayCampaign } from './game-replay-campaign';

const results: Array<{
  seed: number;
  steps: number;
  actionTypes: string[];
  finished: boolean;
}> = [];

afterAll(() => {
  mkdirSync('logs', { recursive: true });
  writeFileSync(
    'logs/replay-idle-timer-results.json',
    JSON.stringify(results, null, 2),
  );
});

it.each([0, 1, 17, 65535])(
  'continues across inter-question timers with seed %i',
  (seed) => {
    const logger = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
    try {
      const definition = discoverGameDefinitions().find(
        (item) => item.id === 'arche-de-mnemosyne',
      );
      if (!definition) throw new Error('Missing Mnemosyne definition');
      const result = runGameReplayCampaign(definition, seed, 64);
      results.push({ seed, ...result });
      expect(result.steps === 64 || result.finished).toBe(true);
      expect(result.steps).toBeGreaterThan(4);
      expect(result.actionTypes).toContain('answer');
    } finally {
      logger.mockRestore();
    }
  },
);
