import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
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
          turn: {
            ...(state.turn ?? { direction: 1 }),
            currentPlayerId: players[nextIndex]?.id ?? null,
            direction: 1,
          },
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
          { id: 'Le Lutin', name: 'Le Lutin', description: '' },
          {
            id: 'Le Bonhomme de Neige',
            name: 'Le Bonhomme de Neige',
            description: '',
          },
        ],
        pawns: {},
      } as any,
      pending: null,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'roll', payload: {} } as any,
    ]);
    expect(next.pending?.type).toBe('pick_pawn');
    expect(String(next.pending?.label ?? '')).toContain('choisir son pion');
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
          { n: 1, title: 'Case dÃ©part', type: 'neutral', description: '' },
          { n: 2, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 3, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 4, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 5, title: 'Case neutre', type: 'neutral', description: '' },
          {
            n: 6,
            title: 'Case Recule - Neige fondue',
            type: 'move',
            delta: -1,
            description: '',
          },
        ],
        decks: { cards: [], discard: [] },
      } as any,
      pending: null,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'roll', payload: {} } as any,
    ]);
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
          { n: 1, title: 'Case dÃ©part', type: 'neutral', description: '' },
          { n: 2, title: 'Case neutre', type: 'neutral', description: '' },
        ],
        decks: { cards: [], discard: [] },
      } as any,
      pending: null,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'roll', payload: {} } as any,
    ]);
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
          { id: 'Le Lutin', name: 'Le Lutin', description: '' },
          { id: 'Le Renne', name: 'Le Renne', description: '' },
          { id: 'Le P?re No?l', name: 'Le P?re No?l', description: '' },
        ],
        pawns: {},
      } as any,
      pending: {
        type: 'pick_pawn',
        playerId: -1,
        blocking: true,
        choices: ['Le Lutin', 'Le Renne', 'Le PÃ¨re NoÃ«l'],
        data: {
          pawns: [
            { id: 'Le Lutin', label: 'Le Lutin' },
            { id: 'Le Renne', label: 'Le Renne' },
            { id: 'Le P?re No?l', label: 'Le P?re No?l' },
          ],
        },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'pick_pawn', payload: { pawnId: 'Le Lutin' } } as any,
    ]);

    expect(next.pending).toBeNull();
    expect((next.players ?? []).find((p: any) => p?.id === -1)?.pawn).toBe(
      'Le Lutin',
    );
    expect(
      (next.players ?? []).find((p: any) => p?.id === -2)?.pawn,
    ).toBeTruthy();
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
          { id: 'Le Lutin', name: 'Le Lutin', description: '' },
          { id: 'Le Renne', name: 'Le Renne', description: '' },
          { id: 'Le P?re No?l', name: 'Le P?re No?l', description: '' },
        ],
      } as any,
      pending: {
        type: 'pick_pawn',
        playerId: '-101',
        blocking: true,
        choices: ['Le Bonhomme de Neige', 'La FÃ©e des Flocons'],
        data: {
          pawns: [
            { id: 'Le Bonhomme de Neige', label: 'Le Bonhomme de Neige' },
            { id: 'La FÃ©e des Flocons', label: 'La FÃ©e des Flocons' },
          ],
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
        choices: ['La FÃ©e des Flocons', 'Le Bonhomme de Neige'],
        data: {
          pawns: [
            { id: 'La FÃ©e des Flocons', label: 'La FÃ©e des Flocons' },
            { id: 'Le Bonhomme de Neige', label: 'Le Bonhomme de Neige' },
          ],
        },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'pick_pawn', payload: { pawnId: 'La FÃ©e des Flocons' } } as any,
    ]);

    expect(next.pending).toBeNull();
    expect(next.turn?.currentPlayerId).toBe(-9);
    expect(next.turnIndex).toBe(1);
  });

  it('logs canonical pawn names (not pawn ids/slugs) when choosing a pawn', () => {
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
        { id: 1, username: 'Lilas', isBot: false } as any,
        { id: -2, username: 'Wallace', isBot: true } as any,
      ],
      metadata: {
        botPlayerIds: [-2],
        starterPlayerId: 1,
        starterTurnIndex: 0,
        starterRestoredAfterPawnSelection: false,
        pawns: {},
        pawnChoices: [
          {
            id: 'fee-des-flocons',
            name: 'La FÃ©e des Flocons',
            description: 'Agile',
          },
          { id: 'lutin', name: 'Le Lutin', description: 'Rapide' },
        ],
      } as any,
      pending: {
        type: 'pick_pawn',
        playerId: 1,
        blocking: true,
        choices: ['La FÃ©e des Flocons: Agile', 'Le Lutin: Rapide'],
        data: {
          pawns: [
            { id: 'fee-des-flocons', label: 'La FÃ©e des Flocons: Agile' },
            { id: 'lutin', label: 'Le Lutin: Rapide' },
          ],
        },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'pick_pawn', payload: { pawnId: 'fee-des-flocons' } } as any,
    ]);
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));
    expect(
      messages.some((m) =>
        m.includes('Lilas a choisi le pion: La FÃ©e des Flocons.'),
      ),
    ).toBe(true);
    expect(messages.some((m) => m.includes('fee-des-flocons'))).toBe(false);
  });

  it('keeps human pawn-choice log before bot auto-assignment logs', () => {
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
        { id: 1, username: 'Lilas', isBot: false } as any,
        { id: -2, username: 'Wallace', isBot: true } as any,
      ],
      metadata: {
        botPlayerIds: [-2],
        starterPlayerId: 1,
        starterTurnIndex: 0,
        starterRestoredAfterPawnSelection: false,
        pawns: {},
        pawnChoices: [
          {
            id: 'bonhomme-pain-epices',
            name: "Le Petit Bonhomme en Pain d'Ã‰pices",
            description: '',
          },
          { id: 'lutin', name: 'Le Lutin', description: '' },
        ],
      } as any,
      pending: {
        type: 'pick_pawn',
        playerId: 1,
        blocking: true,
        choices: ["Le Petit Bonhomme en Pain d'Ã‰pices", 'Le Lutin'],
        data: {
          pawns: [
            {
              id: 'bonhomme-pain-epices',
              label: "Le Petit Bonhomme en Pain d'Ã‰pices",
            },
            { id: 'lutin', label: 'Le Lutin' },
          ],
        },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'pick_pawn', payload: { pawnId: 'bonhomme-pain-epices' } } as any,
    ]);
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));
    const chooseLogs = messages.filter((m) => m.includes('a choisi le pion:'));
    expect(chooseLogs.length).toBeGreaterThan(0);
    expect(chooseLogs[0]).toContain('Lilas a choisi le pion:');
  });

  it('logs quiz result in a single concise sentence', () => {
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
        { id: 1, username: 'Lilas', pawn: 'Le Renne' } as any,
        { id: 2, username: 'Bucky', pawn: 'Le Lutin', isBot: true } as any,
      ],
      metadata: {
        positions: { 1: 0, 2: 0 },
        statuses: { skipTurn: {}, keepTurn: {} },
        pendingQuiz: {
          playerId: 1,
          question: 'Q?',
          choices: ['A', 'B', 'C'],
          answer: 'A',
          anyCorrect: false,
          successDelta: 0,
          failureDelta: 0,
        },
        tiles: [
          { n: 1, title: 'Case dÃ©part', type: 'neutral', description: '' },
          { n: 2, title: 'Case neutre', type: 'neutral', description: '' },
        ],
        decks: { cards: [], discard: [] },
      } as any,
      pending: null,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'answer_quiz', payload: { answer: 'A' } } as any,
    ]);
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));

    expect(messages.some((m) => m.includes('a choisi la bonne'))).toBe(true);
    expect(messages.some((m) => m.toLowerCase().includes('repond.'))).toBe(
      false,
    );
    expect(
      messages.some((m) => m.toLowerCase().includes('bonne reponse.')),
    ).toBe(false);
  });

  it('does not duplicate next-card movement log', () => {
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
        { id: 1, username: 'Lilas', pawn: 'Le Renne' } as any,
        { id: 2, username: 'Bucky', pawn: 'Le Lutin', isBot: true } as any,
      ],
      metadata: {
        positions: { 1: 1, 2: 0 },
        statuses: { skipTurn: {}, keepTurn: {} },
        tiles: [
          { n: 1, title: 'Case dÃ©part', type: 'neutral', description: '' },
          { n: 2, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 3, title: 'Case carte', type: 'card', description: 'Piochez.' },
          { n: 4, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 5, title: 'Case carte', type: 'card', description: 'Piochez.' },
        ],
        decks: {
          cards: [
            {
              id: 99,
              title: 'Luge de vitesse',
              category: 'Surprises',
              kind: 'Surprise',
              lines: ['Avancez jusquÃ  la prochaine Carte NoÃ«l.'],
            },
          ],
          discard: [],
        },
      } as any,
      pending: {
        type: 'draw',
        playerId: 1,
        blocking: true,
        label: 'Piocher.',
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));
    const nextCardMentions = messages.filter((m) =>
      /prochaine Carte/i.test(m),
    ).length;

    expect(nextCardMentions).toBe(1);
  });

  it('stops landing loops without overflowing the call stack', () => {
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
        { id: 1, username: 'Lilas', pawn: 'Le Renne' } as any,
        { id: 2, username: 'Bucky', pawn: 'Le Lutin', isBot: true } as any,
      ],
      metadata: {
        positions: { 1: 2, 2: 5 },
        statuses: { skipTurn: {}, keepTurn: {} },
        tiles: [
          { n: 1, title: 'Case dÃ©part', type: 'neutral', description: '' },
          { n: 2, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 3, title: 'Case neutre', type: 'neutral', description: '' },
          {
            n: 4,
            title: 'Case avance',
            type: 'move',
            delta: 2,
            description: '',
          },
          {
            n: 5,
            title: 'Case avance',
            type: 'move',
            delta: 1,
            description: '',
          },
          { n: 6, title: 'Case neutre', type: 'neutral', description: '' },
        ],
        decks: { cards: [], discard: [] },
      } as any,
      pending: null,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'roll', payload: {} } as any,
    ]);

    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));
    expect(
      messages.some((m) =>
        m.includes(
          'EnchaÃ®nement de cases interrompu pour Ã©viter une boucle infinie.',
        ),
      ),
    ).toBe(true);
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

  it('accepts pick_pawn payload sent as pawnId', () => {
    const state: any = {
      status: 'started',
      turn: { currentPlayerId: 3, direction: 1 },
      players: [{ id: 3, username: 'Lilas' }],
      pending: {
        type: 'pick_pawn',
        playerId: 3,
        blocking: true,
        choices: ['Le Lutin: Agile'],
        data: {
          choices: ['Le Lutin: Agile'],
          pawns: [{ id: 'Le Lutin', label: 'Le Lutin: Agile' }],
        },
      },
      metadata: {},
    };

    const normalized = Rulebook.validateAction(
      state,
      { type: 'pick_pawn', payload: { pawnId: 'Le Lutin' } } as any,
      3,
    );
    expect(normalized).toEqual({
      type: 'pick_pawn',
      payload: { pawnId: 'Le Lutin' },
    });
  });
});
