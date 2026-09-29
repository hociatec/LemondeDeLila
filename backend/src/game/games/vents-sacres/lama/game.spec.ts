import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import documentExtensionSource from './game.json';
import manifest from './manifest.json';

const document = documentExtensionSource;
const definition = compileJsonGame(manifest, document);

describe('LAMA declarative game', () => {
  it('starts a deterministic card round with the declared turn actions', async () => {
    const game = await testGame(definition)
      .players(['Lila', 'Mina'])
      .seed(73)
      .start();
    await game.as(1).do('game.configure', {});

    const actor = game.state().turn?.currentPlayerId ?? 1;
    expect(game.availableActions(actor)).toEqual(
      expect.arrayContaining(['draw', 'cards-discard-penalty-quit']),
    );
    await game.as(actor).do('draw', {});
    expect(await game.replay()).toEqual(game.state());
  });
});
