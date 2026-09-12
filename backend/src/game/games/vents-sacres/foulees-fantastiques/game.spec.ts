import {
  DeclarativeGameRuntime,
  testGame,
} from '../../../engine/testing/public-api';
import type {
  StableGameSystemView,
  StableGameKitsView,
} from '../../../engine/sdk/public-api';
import { compileJsonGame } from '../../../engine/json/public-api';
import manifest from './manifest.json';
import document from './game.json';
import catalogue from './catalogue.json';

const gameDefinition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});

describe('Foulées Fantastiques declarative game', () => {
  it('resolves a pawn choice from the canonical die, including older continuations', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(44);
    await game.start();
    await game.choose(1, 'equides');
    await game.choose(2, 'oiseaux');
    for (let attempt = 0; attempt < 24 && !game.state().pending; attempt++) {
      await game.as(game.state().turn!.currentPlayerId!).do('roll', {});
    }
    const state = game.state();
    const pending = state.pending!;
    expect(pending.data?.choiceId).toBe('foulees.move');
    expect(pending.data?.continuationData).toEqual({
      actorId: pending.playerId,
    });
    const value = (pending.data?.options as string[])[0];
    const legacy = game.state();
    legacy.pending!.data!.continuationData = {
      actorId: pending.playerId,
      roll: 1,
    };
    const runtime = new DeclarativeGameRuntime(gameDefinition);
    const restored = runtime.applyActions(legacy, [
      {
        type: 'choice.resolve',
        payload: { value },
        meta: { actorId: pending.playerId },
      },
    ]);
    expect(restored.turn?.currentPlayerId).toBe(pending.playerId);
    await game.choose(pending.playerId!, value);
    expect(game.state().turn?.currentPlayerId).toBe(pending.playerId);
    expect(await game.replay()).toEqual(game.state());
  });

  it('uses generic sequential family choices', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(43);
    await game.start();
    await game.choose(1, 'equides');
    const waiting = game.state();
    expect(waiting.pending?.playerId).toBe(2);
    expect(waiting.pending?.data?.options).not.toContain('equides');
    await expect(game.choose(2, 'equides')).rejects.toThrow();
    expect(game.state()).toEqual(waiting);
    await game.choose(2, 'oiseaux');
    const system = (game.view(1) as unknown as { system: StableGameSystemView })
      .system;
    expect(system.setup.complete).toBe(true);
    const kits = (game.view(1) as unknown as { kits: StableGameKitsView }).kits;
    expect(kits.pawns?.sets.foulees.assignments).toEqual({
      '1': ['equides:0', 'equides:1', 'equides:2', 'equides:3'],
      '2': ['oiseaux:0', 'oiseaux:1', 'oiseaux:2', 'oiseaux:3'],
    });
    expect(game.state().phase).toBe('turn');
    expect(await game.replay()).toEqual(game.state());
  });

  it('rolls deterministically without exposing move internals', async () => {
    const game = testGame(gameDefinition).players(['Anne', 'Bob']).seed(44);
    await game.start();
    await game.choose(1, 'equides');
    await game.choose(2, 'oiseaux');
    await game.as(1).do('roll', {});
    expect(JSON.stringify(game.view(1))).not.toContain('pendingMove');
    expect(await game.replay()).toEqual(game.state());
  });
});
