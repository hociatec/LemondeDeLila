import { legacyExtensionFixture } from '../../../engine/testing/public-api';
import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import { type StableGameKitsView } from '../../../engine/sdk/public-api';
import { compileJsonGame } from '../../../rules/public-api';
import { GameWsStateMessagesPresenter } from '../../../core/infrastructure/presentation/ws/state/game-ws-state-messages.presenter';
import { projectEventsForPlayer } from '../../../engine/runtime/projection/game-system-view';

import documentExtensionSource from '../../../games/vents-sacres/corridor/game.json';
import manifest from '../../../games/vents-sacres/corridor/manifest.json';
const document = legacyExtensionFixture(documentExtensionSource, 'pathWalls');

const gameDefinition = compileJsonGame(manifest, document);

describe('Corridor declarative game', () => {
  it('announces initial positions and each move without repeating the pawn prompt', async () => {
    const game = testGame(gameDefinition)
      .players(['Hacene', { username: 'Marcelino', isBot: true }])
      .seed(58);
    const messages = async () => {
      const view = game.view(1) as unknown as {
        system: Record<string, unknown>;
      };
      const presented = new GameWsStateMessagesPresenter().withServerMessages(
        {
          ...view.system,
          events: projectEventsForPlayer(await game.events(), 1),
        },
        1,
        {},
      );
      return (
        presented.events as { recent: { data: { message?: string } }[] }
      ).recent
        .map((event) => event.data.message)
        .filter(Boolean);
    };
    await game.start();
    await game.as(1).do('game.configure', { wallsPerPlayer: 0 });
    expect(game.state().pending?.playerId).toBe(1);
    expect(await messages()).not.toContain('Vous devez choisir votre pion.');
    await game.choose(1, 'vent');
    await game.choose(-2, 'eau');
    expect(
      (await messages()).filter(
        (message) => message === 'Vous vous positionnez en E1.',
      ),
    ).toHaveLength(1);
    expect(
      (await messages()).filter(
        (message) => message === 'Marcelino se positionne en E9.',
      ),
    ).toHaveLength(1);
    await game.as(1).do('pathWalls_move', { x: 4, y: 1 });
    expect(await messages()).toContain('Vous vous déplacez en E2.');
    await game.as(-2).do('pathWalls_move', { x: 4, y: 7 });
    expect(await messages()).toContain('Marcelino se déplace en E8.');
    expect(await messages()).not.toContain('Marcelino doit choisir son pion.');
    expect(await game.replay()).toEqual(game.state());
  });

  it('requires distinct pawn choices after wall configuration', async () => {
    const game = testGame(gameDefinition).players(['Vent', 'Eau']).seed(57);
    await game.start();
    await game.as(1).do('game.configure', { wallsPerPlayer: 10 });
    expect(game.state().pending?.playerId).toBe(1);
    expect(game.availableActions(1)).not.toContain('pathWalls_move');
    await game.choose(1, 'vent');
    await game.choose(2, 'eau');
    expect(game.state().pending).toBeNull();
    expect(game.inspect.setupComplete()).toBe(true);
    expect(game.availableActions(1)).toContain('pathWalls_move');
    const kits = (game.view(1) as unknown as { kits: StableGameKitsView }).kits;
    expect(kits.pawns?.sets.pathWalls.assignments['1']).toEqual(['vent']);
    expect(kits.pawns?.sets.pathWalls.assignments['2']).toEqual(['eau']);
  });

  it('lets the bot play after mandatory pawn selection', async () => {
    const game = testGame(gameDefinition)
      .players(['Alice', { username: 'Bot', isBot: true }])
      .seed(58);
    await game.start();
    await game.as(1).do('game.configure', { wallsPerPlayer: 0 });
    await game.choose(1, 'vent');
    await game.choose(-2, 'eau');
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
    await game.choose(1, 'vent');
    await game.choose(2, 'eau');
    await game.as(1).do('pathWalls_move', { x: 4, y: 1 });
    expect(await game.replay()).toEqual(game.state());
  });

  it('blocks crossings, consumes wall stock and retains the wall in replay', async () => {
    const game = testGame(gameDefinition).players(['Vent', 'Eau']).seed(58);
    await game.start();
    await game.as(1).do('game.configure', { wallsPerPlayer: 1 });
    await game.choose(1, 'vent');
    await game.choose(2, 'eau');
    await game
      .as(1)
      .do('pathWalls_place_wall', { x: 4, y: 0, orientation: 'h' });
    await expect(
      game.as(2).do('pathWalls_place_wall', {
        x: 4,
        y: 0,
        orientation: 'v',
      }),
    ).rejects.toThrow();
    await game.as(2).do('pathWalls_move', { x: 4, y: 7 });
    expect(game.availableActions(1)).not.toContain('pathWalls_place_wall');
    await expect(
      game.as(1).do('pathWalls_move', { x: 4, y: 1 }),
    ).rejects.toThrow();
    expect(await game.replay()).toEqual(game.state());
  });
});
