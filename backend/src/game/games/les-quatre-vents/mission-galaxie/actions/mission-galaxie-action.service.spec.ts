import { RandomService } from '../../../../../application/services/random.service';
import { TurnFlowService } from '../../../../../application/services/turn-flow.service';
import { TurnService } from '../../../../../application/services/turn.service';
import { TurnPoliciesService } from '../../../../../application/services/turn-policies.service';
import { GameCoreService } from '../../../../../../../application/services/game-core.service';
import { DeckPoliciesService } from '../../../../../application/features/deck-policies/services/deck-policies.service';
import { MissionGalaxieActionService } from './mission-galaxie-action.service';

function makeState() {
  return {
    status: 'started',
    phase: 'playing',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'P1' },
      { id: 2, username: 'P2' },
      { id: 3, username: 'P3' },
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    pending: null,
    botThinking: false,
    metadata: {
      tiles: [
        { n: 1, title: 'Start', type: 'start' },
        { n: 2, title: 'Move', type: 'move', delta: 1 },
        { n: 3, title: 'Skip', type: 'skip', skipTurns: 1 },
        { n: 4, title: 'Question', type: 'question' },
        { n: 5, title: 'Challenge', type: 'challenge' },
        { n: 6, title: 'Event', type: 'event' },
        { n: 7, title: 'Swap', type: 'swapNearest' },
        { n: 8, title: 'Goto', type: 'goto', target: 2 },
        { n: 9, title: 'Bonus', type: 'neutral', keepTurn: true },
        { n: 10, title: 'Finish', type: 'finish' },
      ],
      positions: { 1: 0, 2: 0, 3: 0 },
      statuses: { skipTurn: { 1: 0, 2: 0, 3: 0 } },
      decks: {
        questions: [
          {
            id: 1,
            title: 'Q1',
            prompt: 'Q',
            choices: ['a', 'b'],
            correctIndex: 0,
            correctDelta: 2,
            wrongDelta: -1,
          },
        ],
        challenges: [
          {
            id: 2,
            title: 'C1',
            prompt: 'C',
            choices: ['x', 'y'],
            correctIndex: 1,
            correctDelta: 3,
            wrongDelta: -2,
          },
        ],
        events: [
          {
            id: 3,
            title: 'E-move',
            description: '',
            effect: { kind: 'move', delta: 2 },
          },
        ],
      },
      discards: { questions: [], challenges: [], events: [] },
      pendingContext: null,
      winnerId: null,
    },
  } as any;
}

function getMeta(state: any) {
  return state.metadata;
}

function makeRuntime(rolls: number[] = []) {
  const random = new RandomService();
  let idx = 0;
  jest.spyOn(random, 'rollDice').mockImplementation((meta: any) => ({
    roll: rolls[idx++] ?? 1,
    meta,
  }));
  const core = new GameCoreService();
  const turns = new TurnFlowService(
    new TurnService(),
    new TurnPoliciesService(core),
  );
  const deckPolicies = new DeckPoliciesService(random);
  return {
    service: new MissionGalaxieActionService(random, turns, core, deckPolicies),
  };
}

describe('MissionGalaxieActionService', () => {
  it('handles skip-turn then roll dispatcher path', () => {
    const { service } = makeRuntime([1, 2]);
    let state = makeState();

    state = {
      ...state,
      metadata: {
        ...getMeta(state),
        statuses: { skipTurn: { 1: 1, 2: 0, 3: 0 } },
      },
    };
    const skipped = service.applyActions(state, [
      { type: 'roll', payload: {} },
    ]);
    expect(getMeta(skipped).statuses.skipTurn[1]).toBe(0);
    expect(skipped.turn?.currentPlayerId).toBe(2);

    const rolled = service.applyActions(makeState(), [
      { type: 'roll', payload: {} },
    ]);
    expect(rolled).toBeDefined();
  });

  it('covers landing tile branches', () => {
    const { service } = makeRuntime();
    const base = makeState();

    for (let pos = 1; pos <= 9; pos += 1) {
      const state = {
        ...base,
        metadata: {
          ...getMeta(base),
          positions: { ...getMeta(base).positions, 1: pos },
        },
      };
      const out = (service as any).applyLanding(state, 1);
      expect(out).toBeDefined();
    }
  });

  it('draws question/challenge and resolves choose_option', () => {
    const { service } = makeRuntime();
    let state = makeState();

    state = {
      ...state,
      pending: {
        type: 'draw',
        playerId: 1,
        blocking: true,
        data: { deck: 'questions' },
      },
    };
    let drawn = service.applyActions(state, [{ type: 'draw', payload: {} }]);
    expect(drawn.pending?.type).toBe('choose_option');
    drawn = service.applyActions(drawn, [
      { type: 'choose_option', payload: { choiceIndex: 0 } },
    ]);
    expect(drawn.pending).toBeNull();

    state = {
      ...makeState(),
      pending: {
        type: 'draw',
        playerId: 1,
        blocking: true,
        data: { deck: 'challenges' },
      },
    };
    drawn = service.applyActions(state, [{ type: 'draw', payload: {} }]);
    expect(drawn.pending?.type).toBe('choose_option');
    drawn = service.applyActions(drawn, [
      { type: 'choose_option', payload: { choiceIndex: 0 } },
    ]);
    expect(drawn).toBeDefined();
  });

  it('covers event effect kinds and choose_event_move resolution', () => {
    const { service } = makeRuntime();
    const base = makeState();
    const effects = [
      { kind: 'move', delta: 2 },
      { kind: 'skip', turns: 1 },
      { kind: 'none' },
      { kind: 'reroll' },
      { kind: 'keepTurn' },
      { kind: 'goto', target: 3 },
      { kind: 'skipOthers', turns: 1 },
      { kind: 'choosePlayerMove', deltas: [2, -1] },
    ] as any[];

    for (const effect of effects) {
      const out = (service as any).applyEventCard(base, 1, {
        id: 100,
        title: `E-${effect.kind}`,
        description: '',
        effect,
      });
      expect(out).toBeDefined();

      if (out.pending?.type === 'choose_event_move') {
        const resolved = service.applyActions(out, [
          {
            type: 'choose_event_move',
            payload: { targetPlayerId: 2, delta: 2 },
          },
        ]);
        expect(resolved.pending).toBeNull();
      }
    }
  });

  it('covers helper methods drawCard, move, skipOthers and finishGame', () => {
    const { service } = makeRuntime();
    const state = makeState();

    const drawOut = (service as any).drawCard(getMeta(state), 'events');
    expect(drawOut).toBeDefined();

    const moved = (service as any).move(state, 1, 3);
    expect(getMeta(moved).positions[1]).toBe(3);

    const skipped = (service as any).skipOthers(state, 1, 2);
    expect(getMeta(skipped).statuses.skipTurn[2]).toBe(2);

    const finished = (service as any).finishGame(state, 1);
    expect(finished.status).toBe('finished');
    expect(getMeta(finished).winnerId).toBe(1);
  });
});






