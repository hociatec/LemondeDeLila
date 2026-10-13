import { Logger } from '@nestjs/common';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import { GENERATED_GAME_PACKAGES } from '../../../composition/generated-game-registry';
import { runCompositionCampaign } from './player-composition-campaign';

const definitions = discoverGameDefinitions();
const [shardIndex, shardCount] = (process.env.GAME_TEST_SHARD ?? '1/1')
  .split('/')
  .map(Number);
if (
  !Number.isSafeInteger(shardIndex) ||
  !Number.isSafeInteger(shardCount) ||
  shardIndex < 1 ||
  shardCount < 1 ||
  shardIndex > shardCount
)
  throw new Error('Invalid GAME_TEST_SHARD: expected index/count');
const report = `logs/player-composition-${shardIndex}-of-${shardCount}`;
const results: object[] = [];
beforeAll(() => {
  mkdirSync('logs', { recursive: true });
  writeFileSync(`${report}.ndjson`, '');
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
});
afterAll(() => {
  jest.restoreAllMocks();
  mkdirSync('logs', { recursive: true });
  writeFileSync(`${report}.json`, JSON.stringify(results, null, 2));
});
it('covers every installed game', () => {
  expect(definitions.length).toBeGreaterThan(0);
  expect(definitions).toHaveLength(GENERATED_GAME_PACKAGES.length);
});
for (const definition of definitions.filter(
  (_, index) => index % shardCount === shardIndex - 1,
)) {
  const counts = [
    ...new Set([definition.players.min, 2, 3, definition.players.max]),
  ].filter(
    (count) =>
      count >= definition.players.min && count <= definition.players.max,
  );
  for (const count of counts) {
    const combinations = new Map<string, boolean[]>();
    for (const decide of [
      () => false,
      () => true,
      (index: number) => index > 0,
      (index: number) => index === count - 1,
      (index: number) => index % 2 === 1,
    ]) {
      const bots = Array.from({ length: count }, (_, index) => decide(index));
      combinations.set(bots.map((bot) => (bot ? 'B' : 'H')).join(''), bots);
    }
    for (const [label, bots] of combinations) {
      it(`${definition.id}: ${label} follows the shared rules and progresses`, () => {
        for (const seed of [1, 17]) {
          const result = runCompositionCampaign(
            definition,
            bots.map((isBot, index) => ({
              username: `Player ${index + 1}`,
              isBot,
            })),
            seed,
          );
          results.push({
            gameId: definition.id,
            composition: label,
            seed,
            ...result,
          });
          appendFileSync(
            `${report}.ndjson`,
            JSON.stringify(results.at(-1)) + '\n',
          );
          expect(result.steps).toBeGreaterThan(0);
          expect(result.finished || result.steps === 64).toBe(true);
          if (bots.every(Boolean)) {
            expect(result.humanActions).toBe(0);
            expect(result.botActions).toBeGreaterThan(0);
          }
          if (bots.every((bot) => !bot)) expect(result.botActions).toBe(0);
        }
      }, 120_000);
    }
  }
}
