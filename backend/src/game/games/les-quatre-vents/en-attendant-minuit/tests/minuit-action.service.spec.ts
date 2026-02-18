import type { GameStateEntity } from '../../../../../core/entities/game-state.entity';
import { SetupFlowService } from '../../../../modules/setup-flow/services/setup-flow.service';
import { DeckPoliciesService } from '../../../../modules/deck-policies/services/deck-policies.service';
import { MinuitActionService } from '../actions/minuit-action.service';
import * as Rulebook from '../rulebook/rulebook';

describe('MinuitActionService', () => {
  const createDeps = () => {
    const random: any = {
      rollDice: jest.fn(() => ({ roll: 1, meta: {} })),
      shuffle: jest.fn((_meta: any, values: any[]) => ({ values, meta: {} })),
    };
    const turns: any = {
      advanceTurn: jest.fn((state: GameStateEntity) => {
        const players = Array.isArray(state.players) ? state.players : [];
        const current = state.turn?.currentPlayerId ?? null;
        const index = players.findIndex((p: any) => p?.id === current);
        const nextIndex = players.length > 0 ? (index + 1) % players.length : 0;
        return {
          ...state,
          turnIndex: nextIndex,
          turn: { ...(state.turn ?? { direction: 1 }), currentPlayerId: players[nextIndex]?.id ?? null, direction: 1 },
        } as GameStateEntity;
      }),
    };
    const core: any = {
      appendLog: jest.fn((state: GameStateEntity, message: string) => ({
        ...state,
        log: [...(Array.isArray(state.log) ? state.log : []), { message }],
      })),
    };
    return { random, turns, core };
  };

  it('sets explicit pawn selection prompt on pending label', () => {
    const { random, turns, core } = createDeps();
    const service = new MinuitActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Lilas' } as any,
        { id: 2, username: 'Alf', isBot: true } as any,
      ],
      metadata: {
        pawnChoices: [
          { title: 'Le Lutin', description: '' },
          { title: 'Le Bonhomme de Neige', description: '' },
        ],
        pawns: {},
      } as any,
      pending: null,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [{ type: 'roll', payload: {} } as any]);
    expect(next.pending?.type).toBe('pick_pawn');
    expect(String(next.pending?.label ?? '')).toContain(
      "C'est à Lilas de choisir son pion",
    );
  });

  it('uses possessive pawn wording in placement log', () => {
    const { random, turns, core } = createDeps();
    random.rollDice.mockReturnValue({ roll: 5, meta: {} });
    const service = new MinuitActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Lilas', pawn: 'Le Bonhomme de Neige' } as any,
        { id: 2, username: 'Alf', pawn: 'Le Lutin', isBot: true } as any,
      ],
      metadata: {
        positions: { 1: 0, 2: 0 },
        statuses: { skipTurn: {}, keepTurn: {} },
        tiles: [
          { n: 1, title: 'Case départ', type: 'neutral', description: '' },
          { n: 2, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 3, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 4, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 5, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 6, title: 'Case Recule - Neige fondue', type: 'move', delta: -1, description: '' },
        ],
        decks: { cards: [], discard: [] },
      } as any,
      pending: null,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [{ type: 'roll', payload: {} } as any]);
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));
    const placement = messages.find((m) => m.includes('Lilas place')) ?? '';

    expect(placement).toMatch(/"son bonhomme de neige"/i);
    expect(placement).not.toContain('"Le Bonhomme de Neige"');
  });

  it('announces next player after turn advance', () => {
    const { random, turns, core } = createDeps();
    random.rollDice.mockReturnValue({ roll: 1, meta: {} });
    const service = new MinuitActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Lilas', pawn: 'Le Bonhomme de Neige' } as any,
        { id: 2, username: 'Alf', pawn: 'Le Lutin', isBot: true } as any,
      ],
      metadata: {
        positions: { 1: 0, 2: 0 },
        statuses: { skipTurn: {}, keepTurn: {} },
        tiles: [
          { n: 1, title: 'Case départ', type: 'neutral', description: '' },
          { n: 2, title: 'Case neutre', type: 'neutral', description: '' },
        ],
        decks: { cards: [], discard: [] },
      } as any,
      pending: null,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [{ type: 'roll', payload: {} } as any]);
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));

    expect(messages).toContain("C'est au tour de Alf.");
  });

  it('does not re-queue pick_pawn for bots without explicit isBot flag', () => {
    const { random, turns, core } = createDeps();
    const service = new MinuitActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: -1, direction: 1 },
      players: [
        { id: -1, username: 'Donatello' } as any,
        { id: -2, username: 'Raphael' } as any,
      ],
      metadata: {
        pawnChoices: [
          { title: 'Le Lutin', description: '' },
          { title: 'Le Renne', description: '' },
          { title: 'Le Père Noël', description: '' },
        ],
        pawns: {},
      } as any,
      pending: {
        type: 'pick_pawn',
        playerId: -1,
        blocking: true,
        choices: ['Le Lutin', 'Le Renne', 'Le Père Noël'],
        data: {
          choices: ['Le Lutin', 'Le Renne', 'Le Père Noël'],
          choiceMap: {
            'Le Lutin': 'Le Lutin',
            'Le Renne': 'Le Renne',
            'Le Père Noël': 'Le Père Noël',
          },
        },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'pick_pawn', payload: { pawn: 'Le Lutin' } } as any,
    ]);

    expect(next.pending).toBeNull();
    expect((next.players ?? []).find((p: any) => p?.id === -1)?.pawn).toBe('Le Lutin');
    expect((next.players ?? []).find((p: any) => p?.id === -2)?.pawn).toBeTruthy();
  });

  it('does not loop pick_pawn when player ids are serialized as strings', () => {
    const { random, turns, core } = createDeps();
    const service = new MinuitActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: -101, direction: 1 },
      players: [
        { id: '-101', username: 'Noodle', isBot: true } as any,
        { id: '7', username: 'hacene', isBot: false } as any,
      ],
      metadata: {
        botPlayerIds: [-101],
        pawns: { '-101': 'Le Lutin' },
        pawnChoices: [
          { title: 'Le Lutin', description: '' },
          { title: 'Le Bonhomme de Neige', description: '' },
          { title: 'La Fée des Flocons', description: '' },
        ],
      } as any,
      pending: {
        type: 'pick_pawn',
        playerId: '-101',
        blocking: true,
        choices: ['Le Bonhomme de Neige', 'La Fée des Flocons'],
        data: {
          choices: ['Le Bonhomme de Neige', 'La Fée des Flocons'],
          choiceMap: {
            'Le Bonhomme de Neige': 'Le Bonhomme de Neige',
            'La Fée des Flocons': 'La Fée des Flocons',
          },
        },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, []);
    expect(next.pending?.type).toBe('pick_pawn');
    expect(next.pending?.playerId).toBe(7);
  });

  it('restores randomized starter after pawn selection', () => {
    const { random, turns, core } = createDeps();
    const service = new MinuitActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new DeckPoliciesService(random),
    );

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'hacene', isBot: false } as any,
        { id: -9, username: 'Noodle', isBot: true } as any,
      ],
      metadata: {
        botPlayerIds: [-9],
        starterPlayerId: -9,
        starterTurnIndex: 1,
        starterRestoredAfterPawnSelection: false,
        pawns: { [-9]: 'Le Lutin' },
      } as any,
      pending: {
        type: 'pick_pawn',
        playerId: 1,
        blocking: true,
        choices: ['La Fée des Flocons', 'Le Bonhomme de Neige'],
        data: {
          choices: ['La Fée des Flocons', 'Le Bonhomme de Neige'],
          choiceMap: {
            'La Fée des Flocons': 'La Fée des Flocons',
            'Le Bonhomme de Neige': 'Le Bonhomme de Neige',
          },
        },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'pick_pawn', payload: { pawn: 'La Fée des Flocons' } } as any,
    ]);

    expect(next.pending).toBeNull();
    expect(next.turn?.currentPlayerId).toBe(-9);
    expect(next.turnIndex).toBe(1);
  });
});

describe('Minuit Rulebook compat', () => {
  it('exposes draw when pending.playerId is serialized as string', () => {
    const state: any = {
      status: 'started',
      turn: { currentPlayerId: 2, direction: 1 },
      players: [
        { id: 1, username: 'Lilas' },
        { id: 2, username: 'Alf', isBot: true },
      ],
      pending: { type: 'draw', playerId: '2', blocking: true },
      metadata: { pendingQuiz: null },
    };

    const actions = Rulebook.getAvailableActions(state, 2);
    expect(actions).toEqual([{ type: 'draw', payload: {} }]);
  });
});
