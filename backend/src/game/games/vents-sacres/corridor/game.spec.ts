import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import { type StableGameKitsView } from '../../../engine/sdk/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';

import document from './game.json';
import manifest from './manifest.json';

const gameDefinition = compileJsonGame(manifest, document);

describe('Corridor declarative game', () => {
  it('starts immediately after wall configuration without a pawn choice', async () => {
    const game = testGame(gameDefinition).players(['Vent', 'Eau']).seed(57);
    await game.start();
    await game.as(1).do('game.configure', { wallsPerPlayer: 10 });
    expect(game.state().pending).toBeNull();
    expect(game.inspect.setupComplete()).toBe(true);
    expect(game.availableActions(1)).toContain('pathWalls_move');
    const kits = (game.view(1) as unknown as { kits: StableGameKitsView }).kits;
    expect(kits.pawns?.sets.pathWalls.assignments['1']).toEqual(['vent']);
    expect(kits.pawns?.sets.pathWalls.assignments['2']).toEqual(['eau']);
  });

  it('lets the bot play after the first human move without a pawn choice', async () => {
    const game = testGame(gameDefinition)
      .players(['Alice', { username: 'Bot', isBot: true }])
      .seed(58);
    await game.start();
    await game.as(1).do('game.configure', { wallsPerPlayer: 0 });
    expect(game.state().pending).toBeNull();
    expect(game.availableActions(1)).not.toContain('pathWalls_place_wall');
    await game.as(1).do('pathWalls_move', { x: 4, y: 1 });
    expect(game.availableActions(1)).toEqual([]);
    const runtime = new DeclarativeGameRuntime(gameDefinition);
    const actions = runtime.getBotActions(game.state(), -2);
    expect(actions).toHaveLength(1);
    const next = runtime.applyActions(
      game.state(),
      actions!.map((action) => ({
        ...action,
        meta: { ...action.meta, actorId: -2 },
      })),
    );
    expect(next.turn?.currentPlayerId).toBe(1);
  });

  it('moves legally and replays deterministically', async () => {
    const game = testGame(gameDefinition).players(['Vent', 'Eau']).seed(58);
    await game.start();
    await game.as(1).do('game.configure', { wallsPerPlayer: 10 });
    await game.as(1).do('pathWalls_move', { x: 4, y: 1 });
    expect(await game.replay()).toEqual(game.state());
  });
});
