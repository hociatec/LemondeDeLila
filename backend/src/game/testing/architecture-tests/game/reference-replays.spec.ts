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
const definitions = discoverGameDefinitions().sort((left, right) =>
  left.id.localeCompare(right.id),
);
const additionalCorpus = definitions.flatMap((definition) =>
  [11, 23, 67]
    .filter(
      (seed) =>
        !corpus.some(
          ([, id, existing]) => id === definition.id && existing === seed,
        ),
    )
    .map((seed) => [definition.id, seed] as const),
);

afterEach(() => jest.restoreAllMocks());

it.each(corpus)('%s reference replay: %s, seed %i', (_family, id, seed) => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  const definition = definitions.find((game) => game.id === id);
  if (!definition) throw new Error(`Missing reference game ${id}`);
  expect(runGameReplayCampaign(definition, seed, 64)).toMatchSnapshot();
});

it.each(additionalCorpus)(
  'catalogue reference replay: %s, seed %i',
  (id, seed) => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    const definition = definitions.find((game) => game.id === id);
    if (!definition) throw new Error(`Missing reference game ${id}`);
    expect(runGameReplayCampaign(definition, seed, 64)).toMatchSnapshot();
  },
);
