import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import { type StableGameKitsView } from '../../../engine/sdk/public-api';
import gameDefinition from './game';

describe('Odyssée des Quatre Cieux declarative game', () => {
  it('uses the stored die rather than a copied roll when completing a choice', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(42);
    await game.start();
    for (let attempt = 0; attempt < 24 && !game.state().pending; attempt++) {
      await game.as(game.state().turn!.currentPlayerId!).do('roll', {});
    }
    const state = game.state();
    const pending = state.pending!;
    expect(pending.data?.choiceId).toBe('odyssee.move');
    const options = pending.data!.options as Array<{ roll: number }>;
    expect(options[0].roll).toBe(6);
    const value = { ...options[0], roll: 1 };
    pending.data!.options = [value, ...options.slice(1)];
    const runtime = new DeclarativeGameRuntime(gameDefinition);
    const next = runtime.applyActions(state, [
      {
        type: 'choice.resolve',
        payload: { value },
        meta: { actorId: pending.playerId },
      },
    ]);
    expect(next.turn?.currentPlayerId).toBe(pending.playerId);
  });

  it('runs dice, choices, turns and replay through engine primitives', async () => {
    const game = testGame(gameDefinition).players(['Alice', 'Bob']).seed(42);
    await game.start();

    for (let step = 0; step < 40; step += 1) {
      const state = game.state();
      const actorId =
        state.pending?.playerId ?? state.turn?.currentPlayerId ?? 1;
      if (state.pending) {
        const options = state.pending.data?.options;
        const value = Array.isArray(options) ? options[0] : null;
        await game
          .as(actorId)
          .do('choice.resolve' as never, { value } as never);
      } else {
        await game.as(actorId).do('roll', {});
      }
      const kits = (
        game.view(actorId) as unknown as { kits: StableGameKitsView }
      ).kits;
      const moved = Object.values(
        kits.pawns?.sets.odyssee.positions ?? {},
      ).some((position) => position >= 0);
      if (moved) break;
    }

    expect(
      Object.values(
        (game.view(1) as unknown as { kits: StableGameKitsView }).kits.pawns
          ?.sets.odyssee.positions ?? {},
      ).some((position) => position >= 0),
    ).toBe(true);
    expect(
      game.state().log.some((entry) => entry.key === 'game.dice.rolled'),
    ).toBe(true);
    expect(await game.replay()).toEqual(game.state());
  });
});
