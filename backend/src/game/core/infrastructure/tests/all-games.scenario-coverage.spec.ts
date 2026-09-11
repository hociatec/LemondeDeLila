import { Logger } from '@nestjs/common';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { GENERATED_GAME_PACKAGES } from '../../../composition/generated-game-registry';
import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import { runGameReplayCampaign } from '../../../testing/architecture-tests/game/game-replay-campaign';

describe('replay campaigns for every installed game', () => {
  const definitions = discoverGameDefinitions();
  let quietLogs: jest.SpyInstance;
  const results: Array<{
    gameId: string;
    seed: number;
    steps: number;
    actionTypes: string[];
    finished: boolean;
  }> = [];
  beforeAll(() => {
    mkdirSync('logs', { recursive: true });
    writeFileSync('logs/game-replay-progress.ndjson', '');
    quietLogs = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => {});
  });
  afterAll(() => {
    quietLogs.mockRestore();
    mkdirSync('logs', { recursive: true });
    writeFileSync(
      'logs/game-replay-campaign-results.json',
      JSON.stringify(
        {
          expectedGames: definitions.length,
          seeds: [0, 1, 17, 65535],
          maximumSteps: 64,
          results,
        },
        null,
        2,
      ),
    );
  });

  it('loads every installed package instead of accepting an empty registry', () => {
    expect(definitions.length).toBeGreaterThan(0);
    expect(definitions).toHaveLength(GENERATED_GAME_PACKAGES.length);
  });

  it.each(
    definitions.map((definition) => [definition.id, definition] as const),
  )(
    '%s replays complete command sequences deterministically',
    (_id, definition) => {
      for (const seed of [0, 1, 17, 65535]) {
        appendFileSync(
          'logs/game-replay-progress.ndjson',
          JSON.stringify({ gameId: definition.id, seed, status: 'started' }) +
            '\n',
        );
        const result = runGameReplayCampaign(definition, seed);
        results.push({ gameId: definition.id, seed, ...result });
        appendFileSync(
          'logs/game-replay-progress.ndjson',
          JSON.stringify({
            gameId: definition.id,
            seed,
            status: 'completed',
            ...result,
          }) + '\n',
        );
        expect(result.steps).toBeGreaterThan(0);
        expect(result.actionTypes.length).toBeGreaterThan(0);
      }
    },
    120_000,
  );
});
