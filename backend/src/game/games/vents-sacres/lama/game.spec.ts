import { legacyExtensionFixture, testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import documentExtensionSource from './game.json';
import manifest from './manifest.json';

const document = legacyExtensionFixture(
  documentExtensionSource,
  'discardPenaltyCards',
);
const definition = compileJsonGame(manifest, document);

describe('LAMA declarative game', () => {
  it('starts a deterministic card round with the declared turn actions', async () => {
    const game = await testGame(definition)
      .players(['Lila', 'Mina'])
      .seed(73)
      .start();

    expect(game.availableActions(1)).toEqual(
      expect.arrayContaining(['draw', 'cards-discard-penalty-pass']),
    );
    await game.as(1).do('draw', {});
    expect(await game.replay()).toEqual(game.state());
  });
});
