import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { createArcheDeMnemosyneRuntime } from '../../arche-de-mnemosyne.runtime';

describe('ArcheDeMnemosyneService prompt actions', () => {
  it('exposes prompt actionType so engine can accept submissions', () => {
    const { service } = createArcheDeMnemosyneRuntime({
      core: { appendLog: (s: any) => s } as any,
      turns: {} as any,
      store: { listCategories: () => [], listQuestions: () => [] } as any,
      random: {} as any,
      initializeStore: false,
    });

    const base: GameStateEntity = {
      status: 'open',
      phase: 'lobby',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [{ id: 1, username: 'hacene' }],
      metadata: {},
    };

    const state = service.hydrateInitialState(base);
    const available = service
      .getAvailableActions(state, 1)
      .map((a: any) => a.type);

    expect(available).toContain('mnemo_set_config');
    expect(available).toContain('mnemo_prompt_cancel');
  });

  it('prevents bot from starting until setup config is validated, then allows it', () => {
    const { service } = createArcheDeMnemosyneRuntime({
      core: { appendLog: (s: any) => s } as any,
      turns: {} as any,
      store: {
        listCategories: () => [{ id: 'c1', name: 'Cat 1' }],
        listQuestions: () => [],
      } as any,
      random: {} as any,
      initializeStore: false,
    });

    const base: GameStateEntity = {
      status: 'open',
      phase: 'lobby',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: -1, username: 'Bot', isBot: true } as any,
        { id: 1, username: 'Owner' } as any,
      ],
      metadata: { roomOwnerId: 1 } as any,
    };

    const state = service.hydrateInitialState(base);

    const botAvailableBefore = service.getAvailableActions(state, -1);
    expect(botAvailableBefore.length).toBe(0);

    const config = service.validateAction(
      state,
      {
        type: 'mnemo_set_config',
        payload: { useTimer: 'oui', timerSeconds: 30, targetPoints: 20 },
      } as any,
      1,
    ) as any;
    const afterConfig = service.applyActions(state, [
      { ...config, meta: { actorId: 1 } },
    ]);

    const ownerAvailableAfter = service
      .getAvailableActions(afterConfig, 1)
      .map((a: any) => a.type);
    expect(ownerAvailableAfter).toContain('mnemo_start');

    expect(() =>
      service.validateAction(
        afterConfig,
        { type: 'mnemo_start', payload: { categoryId: null } } as any,
        -1,
      ),
    ).not.toThrow();
  });

  it('shows setup config prompt to room owner even if a bot is first in players[]', () => {
    const { service } = createArcheDeMnemosyneRuntime({
      core: { appendLog: (s: any) => s } as any,
      turns: {} as any,
      store: { listCategories: () => [], listQuestions: () => [] } as any,
      random: {} as any,
      initializeStore: false,
    });

    const base: GameStateEntity = {
      status: 'open',
      phase: 'lobby',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 99, username: 'Bot', isBot: true } as any,
        { id: 1, username: 'Owner' } as any,
      ],
      metadata: { roomOwnerId: 1 } as any,
    };

    const state = service.hydrateInitialState(base);
    const exposed: any = service.exposeStateForUser(state, 1);
    expect(String(exposed?.pending?.type ?? '')).toBe('config_prompt');
    expect(String(exposed?.pending?.data?.actionType ?? '')).toBe(
      'mnemo_set_config',
    );
  });

  it('makes bots answer randomly for each question', () => {
    const { service } = createArcheDeMnemosyneRuntime({
      core: { appendLog: (s: any) => s } as any,
      turns: {} as any,
      store: { listCategories: () => [], listQuestions: () => [] } as any,
      random: {
        pickIndex: (_meta: any, length: number) => ({
          index: length > 0 ? 0 : 0,
          meta: {},
        }),
      } as any,
      initializeStore: false,
    });

    const state: GameStateEntity = {
      status: 'started',
      phase: 'quiz',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Owner' } as any,
        { id: -1, username: 'Bot A', isBot: true } as any,
        { id: -2, username: 'Bot B', isBot: true } as any,
      ],
      metadata: {
        roomRunId: 7,
        quizDeadlineAtMs: 123,
        currentQuestion: {
          id: 'q1',
          categoryId: 'c1',
          question: 'Q?',
          choices: ['A', 'B', 'C', 'D'],
          correctChoice: 'A',
        },
        quizAnswersByPlayerId: {},
        adminView: { page: 'setup' },
      } as any,
    };

    const a = service.getBotActions(
      { ...state, turn: { currentPlayerId: -1, direction: 1 } } as any,
      -1,
    );
    const b = service.getBotActions(
      { ...state, turn: { currentPlayerId: -2, direction: 1 } } as any,
      -2,
    );
    expect(Array.isArray(a)).toBe(true);
    expect(Array.isArray(b)).toBe(true);
    expect(a?.[0]?.type).toBe('answer_quiz');
    expect(b?.[0]?.type).toBe('answer_quiz');
    expect(Number.isFinite(Number((a?.[0] as any)?.payload?.answerIndex))).toBe(
      true,
    );
    expect(Number.isFinite(Number((b?.[0] as any)?.payload?.answerIndex))).toBe(
      true,
    );
    expect(Number((a?.[0] as any).payload.answerIndex)).toBeGreaterThanOrEqual(
      0,
    );
    expect(Number((a?.[0] as any).payload.answerIndex)).toBeLessThan(4);
    expect(Number((b?.[0] as any).payload.answerIndex)).toBeGreaterThanOrEqual(
      0,
    );
    expect(Number((b?.[0] as any).payload.answerIndex)).toBeLessThan(4);
  });

  it('exposes a stable label for quiz choices (a11y)', () => {
    const { service } = createArcheDeMnemosyneRuntime({
      core: { appendLog: (s: any) => s } as any,
      turns: {} as any,
      store: { listCategories: () => [], listQuestions: () => [] } as any,
      random: {} as any,
      initializeStore: false,
    });

    const state: GameStateEntity = {
      status: 'started',
      phase: 'quiz',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [{ id: 1, username: 'Owner' } as any],
      metadata: {
        roomOwnerId: 1,
        currentQuestion: {
          id: 'q1',
          categoryId: 'c1',
          question: 'Question ?',
          choices: ['A', 'B', 'C', 'D'],
          correctChoice: 'A',
        },
        quizAnswersByPlayerId: {},
        adminView: { page: 'setup' },
      } as any,
    };

    const exposed: any = service.exposeStateForUser(state, 1);
    expect(String(exposed?.pending?.type ?? '')).toBe('quiz');
    expect(String(exposed?.pending?.label ?? '')).toBe('Réponses possibles');
  });
});
