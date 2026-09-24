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

afterEach(() => jest.restoreAllMocks());

it.each(corpus)('%s reference replay: %s, seed %i', (_family, id, seed) => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  const definition = discoverGameDefinitions().find((game) => game.id === id);
  if (!definition) throw new Error(`Missing reference game ${id}`);
  expect(runGameReplayCampaign(definition, seed, 64)).toMatchSnapshot();
});
