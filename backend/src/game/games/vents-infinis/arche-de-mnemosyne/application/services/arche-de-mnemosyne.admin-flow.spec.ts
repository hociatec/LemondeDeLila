import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { ArcheDeMnemosyneService } from './arche-de-mnemosyne.service';
import { ArcheMnemoStateService } from './arche-mnemo-state.service';

class InMemoryMnemoStore {
  categories = [
    { id: 'c1', name: 'Cat 1' },
    { id: 'c2', name: 'Cat 2' },
  ];
  questions = [
    {
      id: 'q1',
      categoryId: 'c1',
      question: 'Question 1 ?',
      correct: 'A',
      wrong1: 'B',
      wrong2: 'C',
      wrong3: 'D',
      status: 'pending',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'q2',
      categoryId: 'c2',
      question: 'Question 2 ?',
      correct: 'Oui',
      wrong1: 'Non',
      wrong2: 'Peut-être',
      wrong3: 'Jamais',
      status: 'validated',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
  ] as any[];

  listCategories() {
    return [...this.categories];
  }

  listQuestions(filter?: { categoryId?: string; status?: string }) {
    let items = [...this.questions];
    if (filter?.categoryId) {
      items = items.filter((q) => q.categoryId === filter.categoryId);
    }
    if (filter?.status) {
      items = items.filter((q) => q.status === filter.status);
    }
    return items;
  }

  createCategory(name: string) {
    const n = String(name ?? '').trim();
    if (!n) throw new Error('Nom vide');
    const id = `c${this.categories.length + 1}`;
    const row = { id, name: n };
    this.categories.push(row);
    return row;
  }

  renameCategory(categoryId: string, name: string) {
    const row = this.categories.find((c) => c.id === categoryId);
    if (!row) throw new Error('Introuvable');
    row.name = String(name ?? '').trim();
    return row;
  }

  deleteCategory(categoryId: string) {
    const before = this.categories.length;
    this.categories = this.categories.filter((c) => c.id !== categoryId);
    if (this.categories.length === before) throw new Error('Introuvable');
    this.questions = this.questions.map((q) =>
      q.categoryId === categoryId ? { ...q, status: 'trash' } : q,
    );
  }

  createQuestion(input: any) {
    if (!String(input?.question ?? '').trim()) throw new Error('Question vide');
    const id = `q${this.questions.length + 1}`;
    const row = {
      id,
      categoryId: String(input.categoryId),
      question: String(input.question),
      correct: String(input.correct),
      wrong1: String(input.wrong1),
      wrong2: String(input.wrong2),
      wrong3: String(input.wrong3),
      status: String(input.status ?? 'validated'),
      createdAt: '2026-01-02T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    };
    this.questions.push(row);
    return row;
  }

  updateQuestion(questionId: string, patch: any) {
    const row = this.questions.find((q) => q.id === questionId);
    if (!row) throw new Error('Question introuvable');
    Object.assign(row, patch, { updatedAt: '2026-01-03T00:00:00.000Z' });
    return row;
  }
}

function makeService() {
  const store = new InMemoryMnemoStore();
  const stateService = new ArcheMnemoStateService();
  const service = new ArcheDeMnemosyneService(
    {
      appendLog: (s: any, message: string) => ({
        ...s,
        log: [...(Array.isArray(s.log) ? s.log : []), { message }],
      }),
    } as any,
    {
      advanceTurn: (s: any) => {
        const ids = (Array.isArray(s.players) ? s.players : [])
          .map((p: any) => Number(p?.id))
          .filter((id: number) => Number.isFinite(id));
        const idx = ids.indexOf(Number(s.turn?.currentPlayerId));
        const nextIdx = idx >= 0 ? (idx + 1) % ids.length : 0;
        return {
          ...s,
          turnIndex: nextIdx,
          turn: { ...(s.turn ?? {}), currentPlayerId: ids[nextIdx] ?? null },
        };
      },
    } as any,
    store as any,
    {
      pickIndex: (_meta: any, len: number) => ({
        index: len > 1 ? 1 : 0,
        meta: {},
      }),
      shuffle: (meta: any, arr: any[]) => ({ meta, values: [...arr] }),
    } as any,
    stateService,
  );
  return { service, stateService, store };
}

function makeBaseState(): GameStateEntity {
  return {
    status: 'open',
    phase: 'lobby',
    round: 1,
    turnIndex: 0,
    lastRoll: null,
    log: [],
    players: [
      { id: 1, username: 'Owner' } as any,
      { id: 2, username: 'J2' } as any,
      { id: 3, username: 'Bot', isBot: true } as any,
    ],
    turn: { currentPlayerId: 1, direction: 1 } as any,
    metadata: { roomOwnerId: 1 } as any,
    pending: null,
    botThinking: false,
  };
}

describe('ArcheDeMnemosyneService admin/game flow', () => {
  it('covers main admin and gameplay action paths', () => {
    const { service, store } = makeService();
    let state = service.hydrateInitialState(makeBaseState());

    state = service.applyActions(state, [
      {
        type: 'mnemo_set_config',
        payload: {
          targetPoints: 2,
          useTimer: 'oui',
          timerSeconds: 10,
          interQuestionSeconds: 2,
          correctSoloPoints: 2,
          correctMultiPoints: 1,
          wrongPoints: -1,
          timeoutPoints: -1,
        },
        meta: { actorId: 1 },
      } as any,
    ]);

    state = service.applyActions(state, [
      {
        type: 'mnemo_start',
        payload: { categoryId: 'c1' },
        meta: { actorId: 1 },
      } as any,
    ]);
    state = service.applyActions(state, [
      { type: 'draw', payload: {}, meta: { actorId: 1 } } as any,
    ]);

    state = service.applyActions(state, [
      {
        type: 'answer_quiz',
        payload: { answerIndex: 0 },
        meta: { actorId: 1 },
      } as any,
      {
        type: 'answer_quiz',
        payload: { answerIndex: 1 },
        meta: { actorId: 2 },
      } as any,
      {
        type: 'answer_quiz',
        payload: { answerIndex: 2 },
        meta: { actorId: 3 },
      } as any,
    ]);

    state = service.applyActions(state, [
      { type: 'mnemo_timeout', payload: {}, meta: { actor: 'system' } } as any,
    ]);

    // Force admin mode and navigate all branches.
    state = {
      ...state,
      phase: 'play',
      turn: {
        ...(state.turn ?? {}),
        direction: 1 as const,
        currentPlayerId: 1,
      },
      metadata: {
        ...(state.metadata as any),
        ownerPlayerId: 1,
        adminView: { page: 'categories' },
      },
    };

    const adminActions: any[] = [
      { type: 'mnemo_open_all_questions', payload: { status: 'all' } },
      { type: 'mnemo_back', payload: {} },
      { type: 'mnemo_open_add_category', payload: {} },
      { type: 'mnemo_add_category', payload: { name: 'Nouvelle Cat' } },
      { type: 'mnemo_open_category', payload: { categoryId: 'c1' } },
      { type: 'mnemo_open_add_question', payload: { categoryId: 'c1' } },
      {
        type: 'mnemo_add_question',
        payload: {
          question: 'Q3 ?',
          correct: 'R1',
          wrong1: 'R2',
          wrong2: 'R3',
          wrong3: 'R4',
        },
      },
      {
        type: 'mnemo_open_questions',
        payload: { categoryId: 'c1', status: 'pending' },
      },
      {
        type: 'mnemo_open_question',
        payload: { categoryId: 'c1', questionId: 'q1' },
      },
      {
        type: 'mnemo_set_question_status',
        payload: { questionId: 'q1', status: 'validated' },
      },
      { type: 'mnemo_open_edit_question', payload: { questionId: 'q1' } },
      {
        type: 'mnemo_edit_question',
        payload: {
          questionId: 'q1',
          question: 'Q1 éditée ?',
          correct: 'A',
          wrong1: 'B',
          wrong2: 'C',
          wrong3: 'D',
        },
      },
      { type: 'mnemo_open_rename_category', payload: { categoryId: 'c1' } },
      {
        type: 'mnemo_rename_category',
        payload: { name: 'Catégorie 1 Renommée' },
      },
      { type: 'mnemo_delete_category', payload: { categoryId: 'c2' } },
      { type: 'mnemo_back', payload: {} },
      { type: 'mnemo_prompt_cancel', payload: {} },
    ];

    for (const action of adminActions) {
      state = service.applyActions(state, [
        { ...action, meta: { actorId: 1 } },
      ]);
    }

    expect(store.listCategories().length).toBeGreaterThan(0);
    expect(Array.isArray((state.log ?? []) as any[])).toBe(true);
  });

  it('covers validation guards and helpers', () => {
    const { service, stateService } = makeService();
    let state = service.hydrateInitialState(makeBaseState());

    expect(() =>
      service.validateAction(
        state,
        { type: 'mnemo_timeout', payload: {}, meta: { actor: 'user' } } as any,
        1,
      ),
    ).toThrow();

    expect(() =>
      service.validateAction(state, { type: 'draw', payload: {} } as any, null),
    ).toThrow();

    state = {
      ...state,
      metadata: {
        ...(state.metadata as any),
        ownerPlayerId: 1,
        prompt: {
          type: 'config_prompt',
          title: 'Prompt',
          actionType: 'mnemo_set_config',
          cancelActionType: 'mnemo_prompt_cancel',
          fields: [],
        },
        promptOwnerId: 1,
      },
    };

    expect(service.exposeStateForUser(state, 1)).toBeDefined();
    expect(service.getAvailableActions(state, 1).length).toBeGreaterThan(0);
    expect(service.getShortcuts({ started: true }).length).toBeGreaterThan(0);
    expect((service as any).parseBool('oui', false)).toBe(true);
    expect(stateService.clampInt('999', 1, 10, 5)).toBe(10);
    expect(stateService.compactQuestionLabel('a'.repeat(120)).length).toBe(
      80,
    );
  });
});
