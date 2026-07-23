import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import { LeMarcheDesMerveillesActionService } from '../actions/le-marche-des-merveilles-action.service';
import { LeMarcheDesMerveillesSetupService } from '../setup/le-marche-des-merveilles-setup.service';
import type { LeMarcheDesMerveillesMetadata } from '../model/le-marche-des-merveilles-state.entity';
import * as Rulebook from '../rulebook/rulebook';

function baseState(): GameStateEntity {
  return {
    status: 'created',
    phase: 'setup',
    round: 0,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'Lila' },
      { id: 2, username: 'Milo' },
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    metadata: {},
    pending: null,
  };
}

function createActionService(): LeMarcheDesMerveillesActionService {
  const core = {
    appendLog: (state: GameStateEntity, message: string): GameStateEntity => ({
      ...state,
      log: [...(state.log ?? []), { message }],
    }),
  };
  const turns = {
    advanceTurn: (state: GameStateEntity): GameStateEntity => {
      const players = state.players ?? [];
      const currentId = state.turn?.currentPlayerId ?? players[0]?.id ?? null;
      const index = players.findIndex((p) => p.id === currentId);
      const next = players[(index + 1) % players.length] ?? players[0];
      return {
        ...state,
        turnIndex: (state.turnIndex ?? 0) + 1,
        turn: {
          ...(state.turn ?? { direction: 1 as const }),
          currentPlayerId: next?.id ?? null,
          direction: 1,
        },
      };
    },
  };
  return new LeMarcheDesMerveillesActionService(core as any, turns as any);
}

describe('LeMarcheDesMerveilles', () => {
  it('hydrates the market with coins, inventory and prices', () => {
    const setup = new LeMarcheDesMerveillesSetupService();
    const state = setup.hydrateInitialState(baseState());
    const meta = state.metadata as LeMarcheDesMerveillesMetadata;

    expect(state.status).toBe('started');
    expect(state.phase).toBe('market');
    expect(meta.coins[1]).toBe(12);
    expect(meta.inventories[1].gemmes).toBe(0);
    expect(meta.prices.reliques).toBe(7);
  });

  it('offers market actions only to the current player', () => {
    const setup = new LeMarcheDesMerveillesSetupService();
    const state = setup.hydrateInitialState(baseState());

    expect(Rulebook.getAvailableActions(state, 1).length).toBeGreaterThan(1);
    expect(Rulebook.getAvailableActions(state, 2)).toEqual([]);
  });

  it('applies buy and sell actions while moving the turn', () => {
    const setup = new LeMarcheDesMerveillesSetupService();
    const actions = createActionService();
    let state = setup.hydrateInitialState(baseState());

    state = actions.applyActions(state, [
      { type: 'buy', payload: { good: 'gemmes' } } as any,
    ]);
    let meta = state.metadata as LeMarcheDesMerveillesMetadata;
    expect(meta.coins[1]).toBe(7);
    expect(meta.inventories[1].gemmes).toBe(1);
    expect(meta.prices.gemmes).toBe(6);
    expect(state.turn?.currentPlayerId).toBe(2);

    state = {
      ...state,
      turn: { ...(state.turn ?? { direction: 1 as const }), currentPlayerId: 1 },
    };
    state = actions.applyActions(state, [
      { type: 'sell', payload: { good: 'gemmes' } } as any,
    ]);
    meta = state.metadata as LeMarcheDesMerveillesMetadata;
    expect(meta.coins[1]).toBe(13);
    expect(meta.inventories[1].gemmes).toBe(0);
    expect(meta.prices.gemmes).toBe(5);
  });

  it('accepts keyboard action aliases', () => {
    const setup = new LeMarcheDesMerveillesSetupService();
    const actions = createActionService();
    let state = setup.hydrateInitialState(baseState());

    expect(() =>
      Rulebook.validateAction(
        state,
        { type: 'buy_gemmes', payload: {} } as any,
        1,
      ),
    ).not.toThrow();

    state = actions.applyActions(state, [
      { type: 'buy_gemmes', payload: {} } as any,
    ]);

    const meta = state.metadata as LeMarcheDesMerveillesMetadata;
    expect(meta.coins[1]).toBe(7);
    expect(meta.inventories[1].gemmes).toBe(1);
  });

  it('finishes after the configured number of turns', () => {
    const setup = new LeMarcheDesMerveillesSetupService();
    const actions = createActionService();
    let state = setup.hydrateInitialState(baseState());

    for (let i = 0; i < 12; i += 1) {
      state = actions.applyActions(state, [{ type: 'pass', payload: {} } as any]);
    }

    expect(state.status).toBe('finished');
    expect((state.metadata as LeMarcheDesMerveillesMetadata).winnerId).toBeNull();
  });
});
