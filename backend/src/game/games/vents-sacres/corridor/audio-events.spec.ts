import {
  legacyExtensionFixture,
  testGame,
} from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import documentSource from './game.json';
import manifest from './manifest.json';

const definition = compileJsonGame(
  manifest,
  legacyExtensionFixture(documentSource, 'pathWalls'),
);

it('announces a committed wall placement with its player for client audio', async () => {
  const game = testGame(definition).players(['Alice', 'Bob']).seed(3);
  await game.start();
  await game.as(1).do('game.configure', { wallsPerPlayer: 10 });
  await game.choose(1, 'vent');
  await game.choose(2, 'eau');
  await game.as(1).do('pathWalls_place_wall', { x: 0, y: 0, orientation: 'h' });
  expect(game.state().log).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        key: 'game.grid.wall.placed',
        params: {
          playerId: 1,
          x: 0,
          y: 0,
          orientation: 'h',
        },
      }),
    ]),
  );
  expect(await game.replay()).toEqual(game.state());
});
