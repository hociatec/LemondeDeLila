import { RandomService } from '../../../../modules/random/services/random.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { GerardPresidentSetupService } from '../setup/gerard-president-setup.service';
import { GerardPresidentActionService } from '../actions/gerard-president-action.service';
import { GERARD_PRESIDENT_SPECIAL_CARDS } from '../model/gerard-president-cards';

function makeBaseState(players = 4) {
  return {
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
  } as any;
}

function makeRuntime() {
  const random = new RandomService();
  jest
    .spyOn(random, 'shuffle')
    .mockImplementation((meta: any, values: any[]) => ({
      values: [...values],
      meta,
    }));
  jest
    .spyOn(random, 'pickIndex')
    .mockImplementation((meta: any, length: number) => ({
      index: length > 0 ? 0 : 0,
      meta,
    }));

  const setup = new GerardPresidentSetupService(random);
  const deckPolicies = new DeckPoliciesService(random);
  const actions = new GerardPresidentActionService(random, deckPolicies);
  const state = setup.hydrateInitialState(makeBaseState());
  return { actions, state };
}

function getMeta(state: any) {
  return state.metadata;
}

describe('GerardPresidentActionService', () => {
  it('handles theme -> names -> winner flow', () => {
    const { actions } = makeRuntime();
    let state = makeRuntime().state;

    state = actions.applyActions(state, [{ type: 'set_theme', payload: {} }]);
    expect(getMeta(state).currentTheme).toBeTruthy();

    const current = state.turn?.currentPlayerId ?? 2;
    const hand = [...(getMeta(state).hands[current] ?? [])];
    state = {
      ...state,
      turn: {
        ...(state.turn ?? {}),
        direction: 1 as 1,
        currentPlayerId: current,
      },
      metadata: {
        ...getMeta(state),
        roundPhase: 'collecting_names',
        pendingPlayers: [current],
      },
    };
    state = actions.applyActions(state, [
      { type: 'play_name', payload: { names: hand.slice(0, 1) } },
    ]);
    expect(getMeta(state).roundPhase).toBe('choosing_winner');

    state = {
      ...state,
      turn: { ...(state.turn ?? {}), direction: 1 as 1, currentPlayerId: 1 },
      metadata: {
        ...getMeta(state),
        roundPhase: 'choosing_winner',
        masterId: 1,
        targetScore: 1,
      },
    };
    state = actions.applyActions(state, [
      { type: 'choose_winner', payload: { winnerId: 2 } },
    ]);
    expect(state.status).toBe('finished');
    expect(getMeta(state).winnerId).toBe(2);
  });

  it('handles pass branch during collecting phase', () => {
    const { actions, state: initial } = makeRuntime();
    const current = 2;
    const state = {
      ...initial,
      turn: {
        ...(initial.turn ?? {}),
        direction: 1 as 1,
        currentPlayerId: current,
      },
      metadata: {
        ...getMeta(initial),
        roundPhase: 'collecting_names',
        pendingPlayers: [current, 3],
        masterId: 1,
      },
    };
    const out = actions.applyActions(state, [{ type: 'pass', payload: {} }]);
    expect(getMeta(out).pendingPlayers).toEqual([3]);
  });

  it('plays every special card effect through public dispatcher', () => {
    const { actions } = makeRuntime();

    for (const special of GERARD_PRESIDENT_SPECIAL_CARDS) {
      let state = makeRuntime().state;
      state = {
        ...state,
        turn: { ...(state.turn ?? {}), direction: 1 as 1, currentPlayerId: 1 },
        metadata: {
          ...getMeta(state),
          roundPhase: 'collecting_names',
          masterId: 1,
          pendingPlayers: [2, 3, 4],
          hands: {
            ...getMeta(state).hands,
            1: ['N1', 'N2', 'N3', 'N4'],
            2: ['A', 'B', 'C'],
            3: ['D', 'E', 'F'],
            4: ['G', 'H', 'I'],
          },
          specialHands: {
            ...getMeta(state).specialHands,
            1: [special.id],
            2: ['sabotage'],
            3: ['sabotage'],
            4: ['sabotage'],
          },
          themeDeck: ['Th1', 'Th2', 'Th3'],
          nameDeck: ['X1', 'X2', 'X3', 'X4', 'X5', 'X6'],
          defenseActive: { 2: true, 3: false, 4: false },
          specialAttackers: { 1: [2, 3] },
          submissions: {},
          extraNamesAllowed: {},
          specialsPlayed: {},
          nameDiscard: [],
          themeDiscard: [],
          specialDiscard: [],
          ghostNames: [],
        },
      };

      const out = actions.applyActions(state, [
        {
          type: 'play_special',
          payload: {
            cardId: special.id,
            targetPlayerId: 2,
            secondaryTargetId: 3,
            name: 'Prénom Test',
          },
        },
      ]);
      expect(out).toBeDefined();
      expect(getMeta(out).specialDiscard.length).toBeGreaterThan(0);
    }
  });

  it('covers helper branches via direct private calls', () => {
    const { actions } = makeRuntime();
    const state = makeRuntime().state;
    const meta = getMeta(state);

    expect((actions as any).findNeighbor(state.players, 2)).toBe(3);
    expect((actions as any).pickRandomPlayer(state.players, 1)).toBe(2);
    expect((actions as any).filterPlayableNames(['A', 'A', 'B', ''])).toEqual([
      'A',
      'B',
    ]);
    expect((actions as any).getNextPlayer(state.players, 4)).toBe(1);

    const removed = (actions as any).removeRandomFromHand(
      {
        ...meta,
        hands: { ...meta.hands, 2: ['K1', 'K2'] },
      },
      2,
      2,
    );
    expect(removed.length).toBeGreaterThan(0);
  });
});
