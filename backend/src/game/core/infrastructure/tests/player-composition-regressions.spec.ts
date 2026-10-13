import { Logger } from '@nestjs/common';
import { discoverGameDefinitions } from '../../../composition/game-module-discovery';
import { runCompositionCampaign } from './player-composition-campaign';

const definitions = discoverGameDefinitions();
beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

it('keeps exchange options in hand until the human resolves the exchange', () => {
  const definition = definitions.find(
    (game) => game.id === 'la-bande-a-banane',
  )!;
  // Previously the hand limit discarded a selectable card at step 18.
  const result = runCompositionCampaign(definition, ['Lila', 'Mina'], 1, 32);
  expect(result.finished || result.steps === 32).toBe(true);
});

it('lets an Olympia bot continue when its only card is temporarily blocked', () => {
  const definition = definitions.find((game) => game.id === 'olympia')!;
  // Previously the bot retried a blocked hero forever at step 50.
  const result = runCompositionCampaign(
    definition,
    ['Lila', { username: 'Bot', isBot: true }, 'Mina'],
    17,
  );
  expect(result.finished || result.steps === 64).toBe(true);
  expect(result.botActions).toBeGreaterThan(0);
  expect(result.humanActions).toBeGreaterThan(0);
});
