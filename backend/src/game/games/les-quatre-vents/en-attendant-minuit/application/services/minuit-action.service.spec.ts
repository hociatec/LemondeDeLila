import type { GameStateEntity } from '../../../../../core/application/models/game-state.model';
import { SetupFlowService } from '../../../../../core/application/services/setup-flow.service';
import { DeckPoliciesService } from '../../../../../deck-policies/application/services/deck-policies.service';
import { MinuitActionService } from '../../application/services/minuit-action.service';
import * as Rulebook from '../../rulebook/rulebook';

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
          { n: 1, title: 'Case départ', type: 'neutral', description: '' },
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
          { n: 1, title: 'Case départ', type: 'neutral', description: '' },
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

  it('logs the die roll with proper accents', () => {
    const { random, turns, core } = createDeps();
    random.rollDice.mockReturnValue({ roll: 2, meta: {} });
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

    expect(messages.some((m) => m.includes('Lilas lance'))).toBe(true);
    expect(messages[0].length).toBeGreaterThan(0);
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
          { id: 'Le Père Noël', name: 'Le Père Noël', description: '' },
        ],
        pawns: {},
      } as any,
      pending: {
        type: 'pick_pawn',
        playerId: -1,
        blocking: true,
        choices: ['Le Lutin', 'Le Renne', 'Le Père Noël'],
        data: {
          pawns: [
            { id: 'Le Lutin', label: 'Le Lutin' },
            { id: 'Le Renne', label: 'Le Renne' },
            { id: 'Le Père Noël', label: 'Le Père Noël' },
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
          { id: 'Le Père Noël', name: 'Le Père Noël', description: '' },
        ],
      } as any,
      pending: {
        type: 'pick_pawn',
        playerId: '-101',
        blocking: true,
        choices: ['Le Bonhomme de Neige', 'La Fée des Flocons'],
        data: {
          pawns: [
            { id: 'Le Bonhomme de Neige', label: 'Le Bonhomme de Neige' },
            { id: 'La Fée des Flocons', label: 'La Fée des Flocons' },
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
        choices: ['La Fée des Flocons', 'Le Bonhomme de Neige'],
        data: {
          pawns: [
            { id: 'La Fée des Flocons', label: 'La Fée des Flocons' },
            { id: 'Le Bonhomme de Neige', label: 'Le Bonhomme de Neige' },
          ],
        },
      } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'pick_pawn', payload: { pawnId: 'La Fée des Flocons' } } as any,
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
            name: 'La Fée des Flocons',
            description: 'Agile',
          },
          { id: 'lutin', name: 'Le Lutin', description: 'Rapide' },
        ],
      } as any,
      pending: {
        type: 'pick_pawn',
        playerId: 1,
        blocking: true,
        choices: ['La Fée des Flocons: Agile', 'Le Lutin: Rapide'],
        data: {
          pawns: [
            { id: 'fee-des-flocons', label: 'La Fée des Flocons: Agile' },
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
        m.includes('Lilas a choisi le pion: La Fée des Flocons.'),
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
            name: "Le Petit Bonhomme en Pain d'Épices",
            description: '',
          },
          { id: 'lutin', name: 'Le Lutin', description: '' },
        ],
      } as any,
      pending: {
        type: 'pick_pawn',
        playerId: 1,
        blocking: true,
        choices: ["Le Petit Bonhomme en Pain d'Épices", 'Le Lutin'],
        data: {
          pawns: [
            {
              id: 'bonhomme-pain-epices',
              label: "Le Petit Bonhomme en Pain d'Épices",
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
          { n: 1, title: 'Case départ', type: 'neutral', description: '' },
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
          { n: 1, title: 'Case départ', type: 'neutral', description: '' },
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
              lines: ['Avancez jusqu’à la prochaine Carte Noël.'],
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
          { n: 1, title: 'Case départ', type: 'neutral', description: '' },
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
          'Enchaînement de cases interrompu pour éviter une boucle infinie.',
        ),
      ),
    ).toBe(true);
  });

  it('stops an occupied-tile bounce loop as soon as a landing position repeats', () => {
    const { random, turns, core } = createDeps();
    const service = new MinuitActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new DeckPoliciesService(random),
    );

    const tiles = Array.from({ length: 28 }, (_, index) => ({
      n: index + 1,
      title: `Case ${index + 1}`,
      type: 'neutral',
      description: '',
    })) as any[];
    tiles[26] = {
      n: 27,
      title: 'Case Avance - Bonnet chanceux',
      type: 'move',
      delta: 1,
      description: 'Votre bonnet vous porte chance. Avancez de 1 case.',
    };

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Lilas', pawn: 'Le Renne' } as any,
        { id: 2, username: 'Bucky', pawn: 'Le Lutin', isBot: true } as any,
      ],
      metadata: {
        positions: { 1: 26, 2: 27 },
        statuses: { skipTurn: {}, keepTurn: {} },
        tiles,
        decks: { cards: [], discard: [] },
      } as any,
      pending: null,
      log: [],
      extras: {},
    } as any;

    const next = (service as any).applyLanding(state, 1);
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));

    expect(
      messages.filter((m) =>
        m.includes(
          'Enchaînement de cases interrompu pour éviter une boucle infinie.',
        ),
      ),
    ).toHaveLength(1);
    expect(
      messages.filter((m) => m.includes('Votre bonnet vous porte chance.'))
        .length,
    ).toBe(1);
  });

  it('detects an occupied landing even when opponent positions are serialized as strings', () => {
    const { random, turns, core } = createDeps();
    const service = new MinuitActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new DeckPoliciesService(random),
    );

    const tiles = Array.from({ length: 8 }, (_, index) => ({
      n: index + 1,
      title: `Case ${index + 1}`,
      type: 'neutral',
      description: '',
    })) as any[];
    tiles[3] = {
      n: 4,
      title: 'Case Avance - Traîneau express',
      type: 'move',
      delta: 3,
      description: 'Avancez de 3 cases.',
    };
    tiles[5] = {
      n: 6,
      title: 'Case Recule - Neige fondue',
      type: 'move',
      delta: -1,
      description: 'Reculez de 1 case.',
    };
    tiles[6] = {
      n: 7,
      title: 'Case Carte Noël',
      type: 'card',
      description: 'Piochez une carte et appliquez son effet.',
    };

    const state: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Lilas', pawn: 'Le Père Noël' } as any,
        { id: 2, username: 'Chipeur', pawn: 'Le Lutin', isBot: true } as any,
      ],
      metadata: {
        positions: { 1: 3, 2: '6' as any },
        statuses: { skipTurn: {}, keepTurn: {} },
        tiles,
        decks: { cards: [], discard: [] },
      } as any,
      pending: null,
      log: [],
      extras: {},
    } as any;

    const next = (service as any).applyLanding(state, 1);
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));

    expect(
      messages.some((m) => m.includes('sur une case occupée : recul')),
    ).toBe(true);
    expect(messages.some((m) => m.includes('en case 6'))).toBe(true);
    expect(next.metadata.positions[1]).toBe(4);
  });

  it('does not auto-roll the die for "Bonnet du Père Noël"', () => {
    const { random, turns, core } = createDeps();
    random.rollDice.mockReturnValue({ roll: 6, meta: {} });
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
        { id: 1, username: 'Lilas', pawn: 'Le Père Noël' } as any,
        { id: 2, username: 'Olaf', pawn: 'Le Lutin', isBot: true } as any,
      ],
      metadata: {
        positions: { 1: 28, 2: 0 },
        statuses: { skipTurn: {}, keepTurn: {} },
        tiles: [
          { n: 1, title: 'Case départ', type: 'neutral', description: '' },
          { n: 2, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 3, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 4, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 5, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 6, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 7, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 8, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 9, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 10, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 11, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 12, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 13, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 14, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 15, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 16, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 17, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 18, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 19, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 20, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 21, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 22, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 23, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 24, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 25, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 26, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 27, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 28, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 29, title: 'Case Carte Noël', type: 'card', description: '' },
          { n: 30, title: 'Case neutre', type: 'neutral', description: '' },
        ],
        decks: {
          cards: [
            {
              id: 2,
              title: 'Bonnet du Père Noël',
              category: 'Cadeaux',
              kind: 'Cadeau',
              lines: [
                'Votre bonnet vous porte chance ! Lancez le dé et avancez du nombre obtenu.',
              ],
            },
          ],
          discard: [],
        },
      } as any,
      pending: { type: 'draw', playerId: 1, blocking: true } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    const messages = (next.log ?? []).map((entry: any) =>
      String(entry?.message ?? ''),
    );

    expect(random.rollDice).not.toHaveBeenCalled();
    expect((next.metadata as any).positions[1]).toBe(28);
    expect(next.turn?.currentPlayerId).toBe(2);
    expect(
      messages.some(
        (m) =>
          m.toLowerCase().includes('bonnet') ||
          m.toLowerCase().includes('doit lancer'),
      ),
    ).toBe(true);
    expect(messages.some((m) => m.includes('Bonus : dé ='))).toBe(false);
  });

  it('replays Lilas bug-report remarks without regressing on occupied tiles or auto-roll bonus cards', () => {
    const { random, turns, core } = createDeps();
    const service = new MinuitActionService(
      random,
      turns,
      core,
      new SetupFlowService(),
      new DeckPoliciesService(random),
    );

    const phaseOne: GameStateEntity = {
      status: 'started',
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      players: [
        { id: 1, username: 'Lilas', pawn: 'Le Père Noël' } as any,
        { id: 2, username: 'Chipeur', pawn: 'Le Lutin', isBot: true } as any,
        {
          id: 3,
          username: 'Polynesia',
          pawn: 'Le Bonhomme de Neige',
          isBot: true,
        } as any,
      ],
      metadata: {
        positions: { 1: 2, 2: 6, 3: 4 },
        statuses: {
          skipTurn: {},
          keepTurn: {},
          ignoreNextMalus: {},
          ignoreNextSkip: {},
          forceDrawNextTurn: {},
        },
        pendingQuiz: {
          playerId: 1,
          question:
            'Quelle célébrité américaine a popularisé pour la première fois la chanson White Christmas dans les années 1940?',
          choices: ['Frank Sinatra', 'Bing Crosby', 'Dean Martin'],
          answer: 'Bing Crosby',
          successDelta: 2,
          failureDelta: 0,
          anyCorrect: false,
        },
        tiles: [
          { n: 1, title: 'Case départ', type: 'neutral', description: '' },
          { n: 2, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 3, title: 'Case Carte Noël', type: 'card', description: '' },
          {
            n: 4,
            title: 'Case Avance - Traîneau express',
            type: 'move',
            delta: 3,
            description:
              "Vous montez à bord d'un traîneau lancé à toute vitesse. Avancez de 3 cases.",
          },
          {
            n: 5,
            title: 'Case neutre - Boulangerie des lutins',
            type: 'neutral',
            description:
              "Une délicieuse odeur de biscuits flotte dans l'air.",
          },
          {
            n: 6,
            title: 'Case Recule - Neige fondue',
            type: 'move',
            delta: -1,
            description:
              'Vous glissez sur une plaque de glace. Reculez de 1 case.',
          },
          {
            n: 7,
            title: 'Case Carte Noël',
            type: 'card',
            description: 'Piochez une carte et appliquez son effet.',
          },
        ],
        decks: { cards: [], discard: [] },
      } as any,
      pending: null,
      log: [],
      extras: {},
    } as any;

    const afterQuiz = service.applyActions(phaseOne, [
      { type: 'answer_quiz', payload: { answer: 'Bing Crosby' } } as any,
    ]);
    const phaseOneMessages = (afterQuiz.log ?? []).map((entry: any) =>
      String(entry?.message ?? ''),
    );

    expect(phaseOneMessages.some((m) => m.includes('a choisi la bonne'))).toBe(
      true,
    );
    expect(
      phaseOneMessages.filter((m) => m.includes('sur une case occup')).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      phaseOneMessages.some((m) =>
        m.includes('en case 4 (Case Avance - Traîneau express).'),
      ),
    ).toBe(true);
    expect(
      phaseOneMessages.some((m) =>
        m.includes('en case 6 (Case Recule - Neige fondue).'),
      ),
    ).toBe(true);
    expect(
      phaseOneMessages.some((m) =>
        m.includes(
          'Enchaînement de cases interrompu pour éviter une boucle infinie.',
        ),
      ),
    ).toBe(true);
    expect((afterQuiz.metadata as any).positions[1]).toBe(3);

    const phaseTwo: GameStateEntity = {
      ...afterQuiz,
      turnIndex: 0,
      turn: { currentPlayerId: 1, direction: 1 },
      pending: { type: 'draw', playerId: 1, blocking: true } as any,
      log: [],
      metadata: {
        ...((afterQuiz.metadata ?? {}) as any),
        pendingQuiz: null,
        positions: { 1: 28, 2: 12, 3: 22 },
        decks: {
          cards: [
            {
              id: 2,
              title: 'Bonnet du Père Noël',
              category: 'Cadeaux',
              kind: 'Cadeau',
              lines: [
                'Votre bonnet vous porte chance ! Lancez le dé et avancez du nombre obtenu.',
              ],
            },
          ],
          discard: [],
        },
        tiles: [
          { n: 1, title: 'Case départ', type: 'neutral', description: '' },
          { n: 2, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 3, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 4, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 5, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 6, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 7, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 8, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 9, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 10, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 11, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 12, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 13, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 14, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 15, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 16, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 17, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 18, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 19, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 20, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 21, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 22, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 23, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 24, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 25, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 26, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 27, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 28, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 29, title: 'Case Carte Noël', type: 'card', description: '' },
          { n: 30, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 31, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 32, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 33, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 34, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 35, title: 'Case neutre', type: 'neutral', description: '' },
        ],
      },
    } as any;

    random.rollDice.mockClear();
    const afterBonnet = service.applyActions(phaseTwo, [
      { type: 'draw', payload: {} } as any,
    ]);
    const phaseTwoMessages = (afterBonnet.log ?? []).map((entry: any) =>
      String(entry?.message ?? ''),
    );

    expect(random.rollDice).not.toHaveBeenCalled();
    expect((afterBonnet.metadata as any).positions[1]).toBe(28);
    expect(afterBonnet.turn?.currentPlayerId).toBe(2);
    expect(
      phaseTwoMessages.some((m) => m.includes('Bonnet du Père Noël')),
    ).toBe(true);
    expect(
      phaseTwoMessages.some(
        (m) =>
          m.toLowerCase().includes('bonnet') ||
          m.toLowerCase().includes('doit lancer'),
      ),
    ).toBe(true);
    expect(phaseTwoMessages.some((m) => m.includes('Bonus : dé ='))).toBe(
      false,
    );
  });

  it('does not add an extra player-specific skip log when a card already says to skip a turn', () => {
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
        { id: 1, username: 'Olaf', pawn: 'Le Bonhomme de Neige' } as any,
        { id: 2, username: 'Lilas', pawn: 'Le Lutin' } as any,
      ],
      metadata: {
        positions: { 1: 0, 2: 0 },
        statuses: { skipTurn: {}, keepTurn: {} },
        tiles: [
          { n: 1, title: 'Case départ', type: 'neutral', description: '' },
        ],
        decks: {
          cards: [
            {
              id: 24,
              title: 'Traîneau bloqué dans la neige',
              category: 'Surprises',
              kind: 'Surprise',
              lines: [
                'Vous devez pelleter pour le dégager. Passez votre tour.',
              ],
            },
          ],
          discard: [],
        },
      } as any,
      pending: { type: 'draw', playerId: 1, blocking: true } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    const messages = (next.log ?? []).map((l: any) => String(l.message ?? ''));

    expect(messages).toContain(
      'Olaf pioche "Traîneau bloqué dans la neige".',
    );
    expect(messages.some((m) => m.includes('Olaf passe 1 tour(s).'))).toBe(
      false,
    );
  });

  it('uses the corrected "Carte de vœux magique" title in the draw log', () => {
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
        { id: 1, username: 'Lilas', pawn: 'Le Lutin' } as any,
        { id: 2, username: 'Olaf', pawn: 'Le Renne' } as any,
      ],
      metadata: {
        positions: { 1: 6, 2: 0 },
        statuses: { skipTurn: {}, keepTurn: {} },
        tiles: [
          { n: 1, title: 'Case départ', type: 'neutral', description: '' },
          { n: 2, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 3, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 4, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 5, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 6, title: 'Case neutre', type: 'neutral', description: '' },
          { n: 7, title: 'Case Carte Noël', type: 'card', description: '' },
        ],
        decks: {
          cards: [
            {
              id: 21,
              title: 'Carte de vœux magique',
              category: 'Surprises',
              kind: 'Surprise',
              lines: ['Elle vous porte chance. Relancez le dé maintenant.'],
            },
          ],
          discard: [],
        },
      } as any,
      pending: { type: 'draw', playerId: 1, blocking: true } as any,
      log: [],
      extras: {},
    } as any;

    const next = service.applyActions(state, [
      { type: 'draw', payload: {} } as any,
    ]);
    const messages = (next.log ?? []).map((entry: any) =>
      String(entry?.message ?? ''),
    );

    expect(messages).toContain('Lilas pioche "Carte de vœux magique".');
    expect(messages.some((message) => /vSux/i.test(message))).toBe(false);
    expect(
      messages.some((message) => /Vous recevez une carte/i.test(message)),
    ).toBe(false);
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
