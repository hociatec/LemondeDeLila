import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import { type StableGameKitsView } from '../../../engine/sdk/public-api';
import MORPION_PAWNS from './content/pawns.json';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from './manifest.json';
import document from './game.json';
const gameDefinition = compileJsonGame(manifest, document, {
  'content/pawns.json': MORPION_PAWNS,
});

describe('Morpion declarative game', () => {
  it('alternates human and bot moves and prevents playing twice', async () => {
    const game = testGame(gameDefinition)
      .players(['Alice', { username: 'Bot', isBot: true }])
      .seed(3);
    await game.start();
    await game.choose(1, MORPION_PAWNS[0].id);
    await game.choose(-2, MORPION_PAWNS[1].id);
    expect(game.state().pending).toBeNull();
    await game.as(1).do('morpion_play', { x: 0, y: 0 });
    expect(game.state().turn?.currentPlayerId).toBe(-2);
    expect(game.availableActions(1)).toEqual([]);
    await expect(
      game.as(1).do('morpion_play', { x: 1, y: 0 }),
    ).rejects.toThrow();
    const runtime = new DeclarativeGameRuntime(gameDefinition);
    const actions = runtime.getBotActions(game.state(), -2);
    expect(actions).toHaveLength(1);
    const state = runtime.applyActions(
      game.state(),
      actions!.map((action) => ({
        ...action,
        meta: { ...action.meta, actorId: -2 },
      })),
    );
    expect(state.turn?.currentPlayerId).toBe(1);
  });
  it('requires distinct pawn choices before allowing play', async () => {
    const game = testGame(gameDefinition)
      .players(['Alice', { username: 'Bot Croix', isBot: true }])
      .seed(3);
    await game.start();

    const assignments = () =>
      (game.view(1) as unknown as { kits: StableGameKitsView }).kits.pawns?.sets
        .morpion.assignments;
    expect(game.state().pending?.playerId).toBe(1);
    expect(game.availableActions(1)).not.toContain('morpion_play');
    await game.choose(1, MORPION_PAWNS[0].id);
    await game.choose(-2, MORPION_PAWNS[1].id);
    expect(assignments()?.['1']).toEqual([MORPION_PAWNS[0].id]);
    expect(assignments()?.['-2']).toEqual([MORPION_PAWNS[1].id]);
    expect(game.availableActions(1)).toHaveLength(9);
    expect(game.availableActions(-2)).toEqual([]);
    expect(game.state().pending).toBeNull();
  });

  it('handles available cells, victory, logs and replay after pawn choices', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(3);
    await game.start();
    await game.choose(1, MORPION_PAWNS[0].id);
    await game.choose(2, MORPION_PAWNS[1].id);
    expect(game.state().pending).toBeNull();
    expect(game.availableActions(1)).toHaveLength(9);

    await game.as(1).do('morpion_play', { x: 0, y: 0 });
    await game.as(2).do('morpion_play', { x: 0, y: 1 });
    await game.as(1).do('morpion_play', { x: 1, y: 0 });
    await game.as(2).do('morpion_play', { x: 1, y: 1 });
    await game.as(1).do('morpion_play', { x: 2, y: 0 });

    expect(game.state().status).toBe('finished');
    expect(game.result()?.winnerPlayerIds).toEqual([1]);
    expect(
      game
        .state()
        .log.some(
          (entry) =>
            entry.key === 'morpion.mark.placed' &&
            entry.params.x === 2 &&
            entry.params.y === 0,
        ),
    ).toBe(true);
    expect(await game.replay()).toEqual(game.state());
  });

  it('rejects occupied cells and proposes a strategic legal bot move', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(8);
    await game.start();
    await game.choose(1, MORPION_PAWNS[0].id);
    await game.choose(2, MORPION_PAWNS[1].id);
    await game.as(1).do('morpion_play', { x: 1, y: 1 });

    await expect(game.as(2).do('morpion_play', { x: 1, y: 1 })).rejects.toThrow(
      'Action indisponible',
    );
  });
});
