import { CaActionService } from '../application/services/ca-actions.service';
import { TurnFlowService } from '../../../../core/application/services/turn-flow.service';
import { TurnService } from '../../../../core/application/services/turn.service';
import { TurnPoliciesService } from '../../../../core/application/services/turn-policies.service';
import { GameCoreService } from '../../../../core/application/services/game-core.service';
import { DeckPoliciesService } from '../../../../deck-policies/application/services/deck-policies.service';
import { CaSetupService } from '../setup/ca.setup';

function card(id: number, kind: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    title: `Carte ${id}`,
    category: 'test',
    kind,
    text: `Effet ${id}`,
    ...extra,
  };
}

describe('CaActionService', () => {
  function makeService(rolls: number[] = []) {
    const random = {
      rollDice: jest.fn((meta: any) => {
        const roll = rolls.length ? rolls.shift()! : 1;
        return { roll, meta };
      }),
      shuffle: jest.fn((meta: any, values: any[]) => ({
        values: [...values].reverse(),
        meta,
      })),
    } as any;

    const core = new GameCoreService();
    const turns = new TurnFlowService(
      new TurnService(),
      new TurnPoliciesService(core),
    );
    const deckPolicies = new DeckPoliciesService(random);
    return {
      service: new CaActionService(random, turns, core, deckPolicies),
      random,
    };
  }

  function makeStartedState(players = 4) {
    const base: any = {
      status: 'started',
      phase: 'playing',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: Array.from({ length: players }, (_, i) => ({
        id: i + 1,
        username: `P${i + 1}`,
      })),
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: {},
      pending: null,
      botThinking: false,
    };
    return new CaSetupService().hydrateInitialState(base);
  }

  function meta(state: any) {
    return state.metadata;
  }

  it('handles neutral vs card landing and draw flow', () => {
    const { service } = makeService([2, 1]);
    let state = makeStartedState();

    const neutral = service.applyActions(state as any, [
      { type: 'roll', payload: {} },
    ]);
    expect(neutral.pending).toBeNull();
    expect(neutral.turn?.currentPlayerId).toBe(2);

    state = makeStartedState();
    const cardLanding = service.applyActions(state as any, [
      { type: 'roll', payload: {} },
    ]);
    expect(cardLanding.pending?.type).toBe('draw');

    const afterDraw = service.applyActions(cardLanding as any, [
      { type: 'draw', payload: {} },
    ]);
    expect(afterDraw.pending).toBeNull();
  });

  it('handles mirror/double/next-delta flags on roll', () => {
    const { service } = makeService([3, 4]);
    let state = makeStartedState();

    state = {
      ...state,
      metadata: {
        ...meta(state),
        lastRollByPlayer: { 2: 5 },
        statuses: {
          ...meta(state).statuses,
          mirrorNextRollFrom: {
            ...meta(state).statuses.mirrorNextRollFrom,
            1: 2,
          },
          doubleNextRoll: { ...meta(state).statuses.doubleNextRoll, 1: true },
          nextPlayerDelta: 1,
        },
      },
      turn: { currentPlayerId: 1, direction: 1 },
    };

    const out = (service as any).handleRoll(state);
    expect(out.lastRoll).toBe(10);
    expect(meta(out).statuses.nextPlayerDelta).toBeNull();
  });

  it('resolves choose_target for swap and mirror contexts', () => {
    const { service } = makeService();
    let state = makeStartedState();

    state = {
      ...state,
      pending: {
        type: 'choose_target',
        playerId: 1,
        blocking: true,
        choices: ['P2'],
      },
      metadata: {
        ...meta(state),
        pendingContext: { kind: 'swap_after_move', actorId: 1 },
        positions: { ...meta(state).positions, 1: 3, 2: 6 },
      },
    };
    let out = (service as any).handleChooseTarget(state, {
      type: 'choose_target',
      payload: { targetPlayerId: 2 },
    });
    expect(meta(out).positions[1]).toBe(6);
    expect(meta(out).positions[2]).toBe(3);

    state = {
      ...makeStartedState(),
      pending: {
        type: 'choose_target',
        playerId: 1,
        blocking: true,
        choices: ['P2'],
      },
      metadata: {
        ...meta(makeStartedState()),
        pendingContext: { kind: 'mirror_next_roll', actorId: 1 },
      },
    };
    out = (service as any).handleChooseTarget(state, {
      type: 'choose_target',
      payload: { targetPlayerId: 2 },
    });
    expect(meta(out).statuses.mirrorNextRollFrom[1]).toBe(2);
  });

  it('resolves choose_next_player and choose_next_delta', () => {
    const { service } = makeService();
    let state = makeStartedState();

    state = {
      ...state,
      pending: {
        type: 'choose_next_player',
        playerId: 1,
        blocking: true,
        choices: ['P3'],
      },
      metadata: {
        ...meta(state),
        pendingContext: { kind: 'choose_next_player', actorId: 1 },
      },
    };
    const picked = (service as any).handleChooseNextPlayer(state, {
      type: 'choose_next_player',
      payload: { playerId: 3 },
    });
    expect(picked.turn?.currentPlayerId).toBe(3);

    state = {
      ...makeStartedState(),
      pending: {
        type: 'choose_next_delta',
        playerId: 1,
        blocking: true,
        choices: ['+1'],
      },
      metadata: {
        ...meta(makeStartedState()),
        pendingContext: { kind: 'choose_next_delta', actorId: 1 },
      },
    };
    const delta = (service as any).handleChooseNextDelta(state, {
      type: 'choose_next_delta',
      payload: { delta: -1 },
    });
    expect(meta(delta).statuses.nextPlayerDelta).toBe(-1);
  });

  it('covers global card variants 41..50', () => {
    const { service } = makeService([1, 2, 3, 4, 5, 6, 1, 2]);
    const base = makeStartedState();

    for (let id = 41; id <= 50; id += 1) {
      const out = (service as any).applyGlobal(
        {
          ...base,
          metadata: {
            ...meta(base),
            positions: { 1: 1, 2: 3, 3: 5, 4: 7 },
          },
        },
        1,
        card(id, 'global'),
      );
      expect(out).toBeDefined();
    }
  });

  it('covers conditional card variants 51..60', () => {
    const { service } = makeService();
    const base = makeStartedState();

    for (let id = 51; id <= 60; id += 1) {
      const out = (service as any).applyConditional(
        {
          ...base,
          metadata: {
            ...meta(base),
            positions: { 1: 5, 2: 6, 3: 4, 4: 5 },
            lastMoveDelta: { 1: 1, 2: -1, 3: 0, 4: 2 },
            turnsSinceMoved: { 1: 3, 2: 0, 3: 2, 4: 1 },
            statuses: {
              ...meta(base).statuses,
              skipTurn: { ...meta(base).statuses.skipTurn, 1: 1 },
            },
          },
          turn: { currentPlayerId: 1, direction: 1 },
        },
        1,
        card(id, 'conditional'),
      );
      expect(out).toBeDefined();
    }
  });

  it('covers special after-move cards 33..37', () => {
    const { service } = makeService();
    const base = makeStartedState();

    for (let id = 33; id <= 37; id += 1) {
      const out = (service as any).applySpecialAfterMove(
        {
          ...base,
          metadata: {
            ...meta(base),
            positions: { 1: 2, 2: 4, 3: 6, 4: 8 },
          },
        },
        1,
        card(id, 'rule', { moveDelta: 1 }),
      );
      expect(out).toBeDefined();
    }
  });

  it('covers rule card variants 61..70 including pending branches', () => {
    const { service } = makeService([2, 5, 3, 4, 6, 1]);
    const base = makeStartedState();

    for (let id = 61; id <= 70; id += 1) {
      const out = (service as any).applyCardEffects(
        {
          ...base,
          metadata: {
            ...meta(base),
            positions: { 1: 2, 2: 5, 3: 7, 4: 9 },
          },
          turn: { currentPlayerId: 1, direction: 1 },
          pending: null,
        },
        1,
        card(id, 'rule', { moveDelta: 1 }),
      );
      expect(out).toBeDefined();

      if (out.pending?.type === 'choose_next_player') {
        const resolved = (service as any).handleChooseNextPlayer(out, {
          type: 'choose_next_player',
          payload: { playerId: 2 },
        });
        expect(resolved.turn?.currentPlayerId).toBe(2);
      }
      if (out.pending?.type === 'choose_next_delta') {
        const resolved = (service as any).handleChooseNextDelta(out, {
          type: 'choose_next_delta',
          payload: { delta: 1 },
        });
        expect(meta(resolved).statuses.nextPlayerDelta).toBe(1);
      }
      if (out.pending?.type === 'choose_target') {
        const resolved = (service as any).handleChooseTarget(out, {
          type: 'choose_target',
          payload: { targetPlayerId: 2 },
        });
        expect(resolved.pending).toBeNull();
      }
    }
  });

  it('covers move/skip/swap branches and drawCard fallback paths', () => {
    const { service } = makeService();
    const base = makeStartedState();

    const moved = (service as any).applyCardEffects(
      base,
      1,
      card(10, 'move', { moveDelta: 2 }),
    );
    expect(moved).toBeDefined();

    const skipped = (service as any).applyCardEffects(
      base,
      1,
      card(11, 'skip'),
    );
    expect(skipped).toBeDefined();

    const swapped = (service as any).applyCardEffects(
      base,
      1,
      card(12, 'swap', { moveDelta: 1 }),
    );
    expect(swapped).toBeDefined();

    const emptyDraw = (service as any).drawCard({
      ...meta(base),
      decks: { cards: [], discard: [] },
    });
    expect(emptyDraw.card).toBeNull();
  });

  it('exercises exported applyActions dispatcher cases', () => {
    const { service } = makeService([1, 2, 3, 4]);
    let state = makeStartedState();

    state = service.applyActions(state as any, [{ type: 'roll', payload: {} }]);
    if (state.pending?.type === 'draw') {
      state = service.applyActions(state as any, [
        { type: 'draw', payload: {} },
      ]);
    }

    state = {
      ...state,
      pending: {
        type: 'choose_next_delta',
        playerId: 1,
        blocking: true,
        choices: ['x'],
      },
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: {
        ...meta(state),
        pendingContext: { kind: 'choose_next_delta', actorId: 1 },
      },
    };
    state = service.applyActions(state as any, [
      { type: 'choose_next_delta', payload: { delta: 1 } },
    ]);
    expect(state).toBeDefined();
  });
});





