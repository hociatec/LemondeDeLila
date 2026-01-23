import { ArcheDeMnemosyneService } from '../arche-de-mnemosyne.service';

describe("ArcheDeMnemosyneService quiz timer", () => {
  const makeService = (questions: any[] = []) =>
    new ArcheDeMnemosyneService(
      { register: jest.fn() } as any,
      {
        appendLog: (s: any, m: string) => ({
          ...s,
          log: [...(Array.isArray(s.log) ? s.log : []), { message: m }],
        }),
      } as any,
      { advanceTurn: (s: any) => s } as any,
      { listCategories: () => [{ id: 'c1', name: 'Cat' }], listQuestions: () => questions } as any,
      {
        pickIndex: (_meta: any, len: number) => ({ index: Math.max(0, Math.min(len - 1, 0)), meta: {} }),
        shuffle: (_meta: any, arr: any) => ({ meta: {}, values: arr }),
      } as any,
    );

  it('stops the quiz timer as soon as everyone answered (clears deadline)', () => {
    const service = makeService([
      {
        id: 'q2',
        categoryId: 'c1',
        question: 'Q2?',
        correct: 'A',
        wrong1: 'B',
        wrong2: 'C',
        wrong3: 'D',
        status: 'validated',
        createdAt: 'x',
        updatedAt: 'x',
      },
    ]);

    const state: any = {
      status: 'started',
      phase: 'play',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'A' },
        { id: 2, username: 'B' },
      ],
      metadata: {
        config: {
          useTimer: true,
          timerSeconds: 30,
          targetPoints: 20,
          correctSoloPoints: 2,
          correctMultiPoints: 1,
          wrongPoints: 0,
          timeoutPoints: -1,
        },
        quizDeadlineAtMs: Date.now() + 30_000,
        currentQuestion: {
          id: 'q1',
          categoryId: 'c1',
          question: 'Q?',
          choices: ['A', 'B', 'C', 'D'],
          correctChoice: 'A',
        },
        quizAnswersByPlayerId: {},
        scoresByPlayerId: { 1: 0, 2: 0 },
        selectedCategoryId: null,
        usedQuestionIds: [],
        adminView: { page: 'setup' },
        prompt: null,
        winnerId: null,
      },
    };

    const afterA = service.applyActions(state, [
      { type: 'answer_quiz', payload: { answerIndex: 0 }, meta: { actorId: 1 } } as any,
    ]);
    expect(afterA.metadata.currentQuestion).toBeTruthy();
    expect(afterA.metadata.quizDeadlineAtMs).toBeTruthy();

    const afterB = service.applyActions(afterA, [
      { type: 'answer_quiz', payload: { answerIndex: 1 }, meta: { actorId: 2 } } as any,
    ]);
    expect(String(afterB.metadata.currentQuestion?.id ?? '')).toBe('q2');
    expect(Object.keys(afterB.metadata.quizAnswersByPlayerId ?? {}).length).toBe(0);
  });

  it('on timeout: logs the correct answer and waits 5s before next question', () => {
    const service = makeService();

    const state: any = {
      status: 'started',
      phase: 'play',
      round: 1,
      turnIndex: 0,
      lastRoll: null,
      log: [],
      players: [
        { id: 1, username: 'Lilas' },
        { id: 2, username: 'Bot', isBot: true },
      ],
      metadata: {
        config: {
          useTimer: true,
          timerSeconds: 1,
          targetPoints: 20,
          correctSoloPoints: 2,
          correctMultiPoints: 1,
          wrongPoints: 0,
          timeoutPoints: -1,
        },
        quizDeadlineAtMs: Date.now() - 1,
        currentQuestion: {
          id: 'q1',
          categoryId: 'c1',
          question: 'Q?',
          choices: ['A', 'B', 'C', 'D'],
          correctChoice: 'A',
        },
        quizAnswersByPlayerId: { 1: 1 }, // wrong
        scoresByPlayerId: { 1: 0, 2: 0 },
        selectedCategoryId: null,
        usedQuestionIds: [],
        adminView: { page: 'setup' },
        prompt: null,
        winnerId: null,
      },
    };

    const after: any = service.applyActions(state, [
      { type: 'mnemo_timeout', payload: {}, meta: { actor: 'system' } } as any,
    ]);

    const messages = (after.log ?? []).map((l: any) => String(l?.message ?? ''));
    expect(messages.some((m: string) => m.includes('La bonne réponse était'))).toBe(true);
    expect(messages.some((m: string) => m.includes('Prochaine question dans 5 secondes'))).toBe(true);
    expect(after.metadata.currentQuestion).toBeNull();
    expect(typeof after.metadata.interQuestionUntilMs).toBe('number');
  });
});
