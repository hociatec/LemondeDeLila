import { compileJsonGame } from '../../../rules/public-api';
import { DeclarativeGameRuntime } from '../../../engine/testing/public-api';
import { createTestGameState } from '../../testing/game-test-state';
import { GameCommandExecutorService } from '../../application/services/game-command-executor.service';
import { GameExecutionScopeService } from '../../application/services/game-execution-scope.service';
import type { GameState } from '../../application/models/game-state.model';
import catalogue from '../../../games/les-quatre-vents/contes-et-cacahuetes/content/catalogue.json';
import document from '../../../games/les-quatre-vents/contes-et-cacahuetes/game.json';
import manifest from '../../../games/les-quatre-vents/contes-et-cacahuetes/manifest.json';

const definition = compileJsonGame(manifest, document, {
  'content/catalogue.json': catalogue,
});
const flag = 'choice-story-challenge.resolution';
type Snapshot = GameState & {
  engine: {
    playerValues: { turnFlags: Record<string, unknown> };
    kits: {
      cards: { decks: Record<string, number[]> };
      movement: { positions: Record<string, Record<string, number>> };
    };
  };
};

describe('Contes cross-player draws', () => {
  it.each([
    [false, false, false],
    [true, true, false],
    [false, true, false],
    [true, false, false],
    [false, false, true],
    [true, true, true],
    [false, true, true],
    [true, false, true],
  ])(
    'rejects off-turn draws when another pawn is moved (bots: %s, %s; earlier draw: %s)',
    (firstBot, secondBot, earlierDraw) => {
      const runtime = new DeclarativeGameRuntime(definition);
      const executor = new GameCommandExecutorService(
        new GameExecutionScopeService(),
      );
      let state = runtime.hydrateInitialState(
        createTestGameState({
          definition,
          players: [firstBot, secondBot].map((isBot, i) => ({
            username: `Player ${i}`,
            isBot,
          })),
          seed: 1,
          startedAt: '2023-11-14T22:13:20.000Z',
        }),
      ) as Snapshot;
      const execute = (actorId: number, type: string, payload = {}) => {
        state = executor.execute({
          handler: runtime,
          state,
          actorId,
          actions: [{ type, payload }],
        }) as Snapshot;
      };
      while (state.pending) {
        const id = state.pending.playerId!;
        const action = runtime.getAvailableActions(state, id)[0];
        execute(id, action.type, action.payload);
      }
      const owner = state.turn!.currentPlayerId!;
      const recipient = state.players!.find(
        (player) => player.id !== owner,
      )!.id;
      const turnNumber = state.turn!.turnNumber;
      state.engine.playerValues.turnFlags[flag] = {
        playerId: owner,
        types: earlierDraw ? ['bonus', 'conte'] : ['bonus'],
      };
      state.engine.kits.cards.decks.bonus = [5]; // Poussière de Fée: move another player two spaces.
      state.engine.kits.movement.positions['story-road'][recipient] = 0;
      expect(runtime.getAvailableActions(state, recipient)).toHaveLength(0);
      expect(() => execute(recipient, 'draw_card')).toThrow();
      expect(() =>
        executor.execute({
          handler: runtime,
          state,
          actorId: null,
          actions: [
            { type: 'draw_card', payload: {}, meta: { actorId: recipient } },
          ],
        }),
      ).toThrow();
      execute(owner, 'draw_card');
      expect(
        state.engine.kits.movement.positions['story-road'][recipient],
      ).toBe(2);
      if (earlierDraw) {
        expect(state.pending).toBeNull();
        expect(state.turn?.currentPlayerId).toBe(owner);
        expect(state.engine.playerValues.turnFlags[flag]).toEqual({
          playerId: owner,
          types: ['conte'],
        });
        expect(runtime.getAvailableActions(state, recipient)).toHaveLength(0);
        expect(() => execute(recipient, 'draw_card')).toThrow();
        expect(() =>
          execute(recipient, 'choice.resolve', { value: 'draw' }),
        ).toThrow();
        execute(owner, 'draw_card');
      }
      expect(state.pending).toBeNull();
      expect(state.turn?.currentPlayerId).toBe(recipient);
      expect(state.turn?.turnNumber).toBe(turnNumber! + 1);
      expect(state.engine.playerValues.turnFlags[flag]).toBeUndefined();
      expect(
        runtime
          .getAvailableActions(state, recipient)
          .map((action) => action.type),
      ).toContain('roll');
      expect(() => execute(recipient, 'draw_card')).toThrow();
      expect(() => execute(owner, 'draw_card')).toThrow();
    },
  );
});
