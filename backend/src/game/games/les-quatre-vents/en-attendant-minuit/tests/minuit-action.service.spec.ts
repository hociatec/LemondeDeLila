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

  it('logs explicit pawn selection prompt', () => {
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
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));

    expect(next.pending?.type).toBe('pick_pawn');
    expect(messages).toContain('Lilas doit choisir un pion.');
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
