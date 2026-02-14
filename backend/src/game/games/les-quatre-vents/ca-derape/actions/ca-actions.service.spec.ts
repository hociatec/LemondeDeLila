import { CaActionService } from './ca-actions.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { TurnService } from '../../../../modules/turn/services/turn.service';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { CaSetupService } from '../setup/ca.setup';

describe('Ça Dérape ! - action flow', () => {
  function makeService(rolls: number[]) {
    const random = {
      rollDice: jest.fn((meta: any, _sides: number) => {
        const roll = rolls.length ? rolls.shift()! : 1;
        return { roll, meta };
      }),
      shuffle: jest.fn((meta: any, values: any[]) => ({ values, meta })),
    } as any;

    const turns = new TurnFlowService(new TurnService());
    const core = new GameCoreService();
    const deckPolicies = new DeckPoliciesService(random);
    return new CaActionService(random, turns, core, deckPolicies);
  }

  function makeStartedState() {
    const base: any = {
      status: 'started',
      phase: 'playing',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      turn: { currentPlayerId: 1, direction: 1 },
      metadata: {},
      pending: null,
      botThinking: false,
    };
    return new CaSetupService().hydrateInitialState(base);
  }

  it('does not require a draw on neutral tiles, and advances the turn after roll', () => {
    // Roll 2: from start (case 1) -> case 3 (neutral).
    const svc = makeService([2]);
    const state = makeStartedState();

    const next = svc.applyActions(state as any, [{ type: 'roll', payload: {} }]);

    expect(next.pending).toBeNull();
    expect(next.turn?.currentPlayerId).toBe(2);
  });

  it('requires a draw on non-neutral tiles after roll', () => {
    // Roll 1: from start (case 1) -> case 2 (non-neutral).
    const svc = makeService([1]);
    const state = makeStartedState();

    const next = svc.applyActions(state as any, [{ type: 'roll', payload: {} }]);

    expect(next.pending?.type).toBe('draw');
    expect(next.pending?.playerId).toBe(1);
    // Turn stays on the same player until draw resolves.
    expect(next.turn?.currentPlayerId).toBe(1);
  });

  it('advances to next player after resolving a drawn card', () => {
    // Roll 1 lands on a card tile, then draw resolves and turn advances.
    const svc = makeService([1]);
    const state = makeStartedState();

    const rolled = svc.applyActions(state as any, [{ type: 'roll', payload: {} }]);
    expect(rolled.pending?.type).toBe('draw');

    const afterDraw = svc.applyActions(rolled as any, [{ type: 'draw', payload: {} }]);
    expect(afterDraw.pending).toBeNull();
    expect(afterDraw.turn?.currentPlayerId).toBe(2);
  });
});
