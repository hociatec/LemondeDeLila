import { legacyExtensionFixture, testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import documentExtensionSource from './game.json';
import manifest from './manifest.json';

const document = legacyExtensionFixture(documentExtensionSource, 'pathWalls');
const definition = compileJsonGame(manifest, document);

describe('Le Corridor declarative game', () => {
  it('requires distinct pawn choices before exposing legal board actions', async () => {
    const game = await testGame(definition)
      .players(['Lila', 'Mina'])
      .seed(71)
      .start();

    await game.choose(1, 'vent');
    await game.choose(2, 'eau');

    expect(game.availableActions(1)).toContain('pathWalls_move');
    expect(game.availableActions(2)).toEqual([]);
    expect(await game.replay()).toEqual(game.state());
  });
});
