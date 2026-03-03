import { RandomService } from '../../../../modules/random/services/random.service';
import { TurnFlowService } from '../../../../modules/turn/services/turn-flow.service';
import { TurnService } from '../../../../modules/turn/services/turn.service';
import { TurnPoliciesService } from '../../../../modules/turn-policies/services/turn-policies.service';
import { GameCoreService } from '../../../../core/services/game-core.service';
import { LaParadeSucreeSetupService } from '../setup/la-parade-sucree-setup.service';
import { LaParadeSucreeActionService } from '../actions/la-parade-sucree-action.service';
import { LA_PARADE_SEQUENCE } from '../model/la-parade-sucree-cards';

function makeBaseState(players = 3) {
  return {
    status: 'started',
    phase: 'round',
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
  const setup = new LaParadeSucreeSetupService(random);
  const core = new GameCoreService();
  const turns = new TurnFlowService(
    new TurnService(),
    new TurnPoliciesService(core),
  );
  const actions = new LaParadeSucreeActionService(core, turns);
  const state = setup.hydrateInitialState(makeBaseState());
  return { actions, state };
}

function meta(state: any) {
  return state.metadata;
}

describe('LaParadeSucreeActionService', () => {
  it('plays a valid card and rejects wrong sequence card', () => {
    const { actions, state: initial } = makeRuntime();

    const invalid = actions.applyActions(initial, [
      { type: 'play_card', payload: { cardId: 'parade-3' } },
    ]);
    expect(meta(invalid).sequenceIndex).toBe(0);

    const valid = actions.applyActions(initial, [
      { type: 'play_card', payload: { cardId: 'parade-2' } },
    ]);
    expect(meta(valid).sequenceIndex).toBe(1);
    expect(meta(valid).played).toContain('parade-2');
    expect((meta(valid).hands[1] ?? []).includes('parade-2')).toBe(false);
  });

  it('applies special rewards and pass action', () => {
    const { actions, state: initial } = makeRuntime();
    const state = {
      ...initial,
      turn: { ...(initial.turn ?? {}), currentPlayerId: 1 },
      metadata: {
        ...meta(initial),
        sequenceIndex: LA_PARADE_SEQUENCE.indexOf('7'),
        hands: {
          ...meta(initial).hands,
          1: [...(meta(initial).hands[1] ?? []), 'parade-7'],
        },
      },
    };
    const rewarded = actions.applyActions(state, [
      { type: 'play_card', payload: { cardId: 'parade-7' } },
    ]);
    expect(meta(rewarded).candies[1]).toBeDefined();

    const passed = actions.applyActions(rewarded, [
      { type: 'pass', payload: {} },
    ]);
    expect(passed.turn?.currentPlayerId).not.toBe(1);
  });

  it('finishes game and resolves winner / tie helper branches', () => {
    const { actions, state: initial } = makeRuntime();

    const finished = (actions as any).finishGame({
      ...initial,
      metadata: {
        ...meta(initial),
        candies: {
          1: { Chamallow: 4, Chocobon: 1, Balisto: 0 },
          2: { Chamallow: 1, Chocobon: 1, Balisto: 0 },
        },
      },
    });
    expect(finished.status).toBe('finished');
    expect(meta(finished).winnerId).toBe(1);

    const tieWinner = (actions as any).determineWinner({
      ...meta(initial),
      candies: {
        1: { Chamallow: 2, Chocobon: 0, Balisto: 0 },
        2: { Chamallow: 2, Chocobon: 0, Balisto: 0 },
      },
    });
    expect(tieWinner).toBeNull();
  });

  it('covers helper methods and finish conditions', () => {
    const { actions, state: initial } = makeRuntime();
    expect(
      (actions as any).computeCandyValue({ Chamallow: 2, Chocobon: 1 }),
    ).toBeGreaterThan(0);
    expect(
      (actions as any).scoreCandies({ Chamallow: 1, Chocobon: 1, Balisto: 1 }),
    ).toBeGreaterThan(0);

    const bySequence = (actions as any).isGameFinished({
      ...meta(initial),
      sequenceIndex: LA_PARADE_SEQUENCE.length,
      hands: { 1: ['x'] },
    });
    expect(bySequence).toBe(true);

    const byHands = (actions as any).isGameFinished({
      ...meta(initial),
      sequenceIndex: 1,
      hands: { 1: [], 2: [] },
    });
    expect(byHands).toBe(true);
  });
});
