import { Logger } from '@nestjs/common';
import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import { runGameReplayCampaign } from './game-replay-campaign';

// Stable games, seeds and command-selection policy. The digest covers the initial
// state, every command, actor, clock and resulting state, not just the winner.
const corpus = [
  ['board', 'panier-express', 11],
  ['cards', 'pimp-my-ride', 23],
  ['choice', 'cat-pattes', 37],
  ['collection', 'la-bande-a-banane', 41],
  ['race', 'a-fond-les-ballons', 53],
  ['spatial', 'morpion', 67],
] as const;
const selectedIds = new Set(
  (process.env.GAME_TEST_GAME_IDS ?? '').split(',').filter(Boolean),
);
const [shardIndex, shardCount] = (process.env.GAME_TEST_SHARD ?? '1/1')
  .split('/')
  .map(Number);
const definitions = discoverGameDefinitions().sort((left, right) =>
  left.id.localeCompare(right.id),
);
const selected = (id: string) => {
  const index = definitions.findIndex((definition) => definition.id === id);
  return (
    index >= 0 &&
    (selectedIds.size === 0 || selectedIds.has(id)) &&
    index % shardCount === shardIndex - 1
  );
};
const catalogueSeeds = [11, 23, 67] as const;
const additionalCorpus = definitions.flatMap((definition) =>
  catalogueSeeds
    .filter(
      (seed) =>
        !corpus.some(
          ([, id, existing]) => id === definition.id && existing === seed,
        ),
    )
    .map((seed) => [definition.id, seed] as const),
);

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

for (const [family, id, seed] of corpus) {
  const testCase = selected(id) ? it : it.skip;
  testCase(`${family} reference replay: ${id}, seed ${seed}`, () => {
    const definition = definitions.find((game) => game.id === id);
    if (!definition) throw new Error(`Missing reference game ${id}`);
    expect(runGameReplayCampaign(definition, seed, 64)).toMatchSnapshot();
  });
}

for (const [id, seed] of additionalCorpus) {
  const testCase =
    selected(id) && (process.env.GAME_TEST_PROFILE !== 'fast' || seed === 23)
      ? it
      : it.skip;
  testCase(`catalogue reference replay: ${id}, seed ${seed}`, () => {
    const definition = definitions.find((game) => game.id === id);
    if (!definition) throw new Error(`Missing reference game ${id}`);
    expect(runGameReplayCampaign(definition, seed, 64)).toMatchSnapshot();
  });
}
