import { testGame } from '../../../engine/testing/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import documentExtensionSource from './game.json';
import manifest from './manifest.json';

const document = documentExtensionSource;
const definition = compileJsonGame(manifest, document);

describe('Le Corridor declarative game', () => {
  it('requires distinct pawn choices before exposing legal board actions', async () => {
    const game = await testGame(definition)
      .players(['Lila', 'Mina'])
      .seed(71)
      .start();

    await game.as(1).do('game.configure', { wallsPerPlayer: 10 });
    await game.choose(1, 'vent');
    await game.choose(2, 'eau');

    expect(game.availableActions(1)).toContain('pathWalls_move');
    expect(game.availableActions(2)).toEqual([]);

    await game.as(1).do('pathWalls_place_wall', {
      x: 0,
      y: 0,
      orientation: 'h',
    });
    const resourceEvents = (await game.events()).filter(
      (event) => event.type === 'resource.changed',
    );
    expect(resourceEvents).not.toHaveLength(0);
    expect(resourceEvents).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          data: expect.objectContaining({
            resource: 'board-path-walls.walls',
            value: 9,
            announce: false,
          }),
        }),
      ]),
    );
    expect(await game.replay()).toEqual(game.state());
  });
});
