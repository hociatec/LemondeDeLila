import type { GameStateEntity } from '../../../../../application/models/game-state.model';
import { ArcheDeMnemosyneService } from './arche-de-mnemosyne.service';
import { ArcheMnemoStateService } from './arche-mnemo-state.service';

function makeService() {
  const store = {
    listCategories: () => [
      { id: 'c1', name: 'Catégorie 1' },
      { id: 'c2', name: 'Catégorie 2' },
    ],
    listQuestions: () => [
      {
        id: 'q1',
        categoryId: 'c1',
        question: 'Q1 ? ',
        correct: 'A',
        wrong1: 'B',
        wrong2: 'C',
        wrong3: 'D',
        status: 'validated',
      },
    ],
  };

  const service = new ArcheDeMnemosyneService(
    {
      appendLog: (state: any, message: string) => ({
        ...state,
        log: [...(Array.isArray(state.log) ? state.log : []), { message }],
      }),
    } as any,
    {
      advanceTurn: (state: any) => state,
    } as any,
    store as any,
    {
      pickIndex: (_meta: any, _len: number) => ({ index: 0, meta: {} }),
      shuffle: (meta: any, values: any[]) => ({ meta, values: [...values] }),
    } as any,
    new ArcheMnemoStateService(),
  );

  return { service, store };
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
      { id: 1, username: 'BotOwner', isBot: true } as any,
      { id: 2, username: 'Player' } as any,
    ],
    turn: { currentPlayerId: 1, direction: 1 },
    metadata: { roomOwnerId: 1 } as any,
    pending: null,
    botThinking: false,
  };
}

describe('ArcheDeMnemosyneService helper branches', () => {
  it('syncs bot pending states for setup/play/question branches', () => {
    const { service } = makeService();
    const hydrated = service.hydrateInitialState(makeBaseState());
    const meta = hydrated.metadata as any;

    const withPrompt = {
      ...hydrated,
      phase: 'setup',
      pending: null,
      metadata: {
        ...meta,
        prompt: {
          type: 'config_prompt',
          title: 'Config',
          actionType: 'mnemo_set_config',
          cancelActionType: 'mnemo_prompt_cancel',
          fields: [],
        },
        promptOwnerId: 1,
      },
    } as GameStateEntity;

    const setupPromptPending = (service as any).syncBotPending(withPrompt);
    expect(setupPromptPending.pending).toEqual({
      type: 'mnemo_set_config',
      playerId: 1,
      blocking: true,
    });

    const setupStart = {
      ...withPrompt,
      metadata: {
        ...(withPrompt.metadata as any),
        prompt: null,
        promptOwnerId: null,
      },
    } as GameStateEntity;
    const setupStartPending = (service as any).syncBotPending(setupStart);
    expect(setupStartPending.pending).toEqual({
      type: 'mnemo_start',
      playerId: 1,
      blocking: true,
    });

    const playDraw = {
      ...setupStart,
      phase: 'play',
      metadata: {
        ...(setupStart.metadata as any),
        currentQuestion: null,
        interQuestionUntilMs: null,
      },
    } as GameStateEntity;
    const playDrawPending = (service as any).syncBotPending(playDraw);
    expect(playDrawPending.pending).toEqual({
      type: 'draw',
      playerId: 1,
      blocking: true,
    });

    const playQuiz = {
      ...playDraw,
      metadata: {
        ...(playDraw.metadata as any),
        currentQuestion: {
          id: 'q1',
          categoryId: 'c1',
          question: 'Q1 ?',
          choices: ['A', 'B', 'C', 'D'],
          correctChoice: 'A',
        },
        quizAnswersByPlayerId: {},
      },
      pending: null,
    } as GameStateEntity;
    const playQuizPending = (service as any).syncBotPending(playQuiz);
    expect(playQuizPending.pending).toEqual({
      type: 'quiz',
      playerId: 1,
      blocking: true,
    });
  });

  it('builds pending/actions for prompt, setup and play states', () => {
    const { service } = makeService();
    const hydrated = service.hydrateInitialState(makeBaseState());

    const promptState = {
      ...hydrated,
      phase: 'setup',
      metadata: {
        ...(hydrated.metadata as any),
        adminView: { page: 'setup' },
        prompt: {
          type: 'text_prompt',
          title: 'Ajouter',
          label: 'Nom',
          actionType: 'mnemo_add_category',
          payloadKey: 'name',
          cancelActionType: 'mnemo_prompt_cancel',
          initialText: 'demo',
        },
        promptOwnerId: 1,
      },
    } as GameStateEntity;

    const pendingForOwner = (service as any).buildPendingForUser(
      promptState,
      1,
    );
    expect(pendingForOwner).toEqual({
      type: 'text_prompt',
      playerId: 1,
      label: 'Nom',
      data: {
        title: 'Ajouter',
        actionType: 'mnemo_add_category',
        payloadKey: 'name',
        initialText: 'demo',
        cancelActionType: 'mnemo_prompt_cancel',
      },
    });

    const ownerActions = (service as any).buildActionsForUser(promptState, 1);
    expect(ownerActions).toEqual([
      { type: 'mnemo_add_category', payload: {} },
      { type: 'mnemo_prompt_cancel', payload: {} },
    ]);

    const nonOwnerSetupActions = (service as any).buildActionsForUser(
      promptState,
      2,
    );
    expect(nonOwnerSetupActions).toEqual([]);

    const playState = {
      ...promptState,
      phase: 'play',
      pending: { type: 'draw', playerId: 1, blocking: true } as any,
      metadata: {
        ...(promptState.metadata as any),
        prompt: null,
        promptOwnerId: null,
        currentQuestion: null,
        interQuestionUntilMs: null,
      },
    } as GameStateEntity;
    const drawActions = (service as any).buildActionsForUser(playState, 1);
    expect(drawActions).toEqual([{ type: 'draw', payload: {} }]);

    const waitingState = {
      ...playState,
      metadata: {
        ...(playState.metadata as any),
        interQuestionUntilMs: Date.now() + 2000,
      },
    } as GameStateEntity;
    expect((service as any).buildPendingForUser(waitingState, 1)).toBeNull();
  });

  it('covers helper utilities and default metadata guards', () => {
    const { service } = makeService();

    expect((service as any).parseBool('on', false)).toBe(true);
    expect((service as any).parseBool('off', true)).toBe(false);
    expect((service as any).parseBool('unknown', true)).toBe(true);

    expect((service as any).normalizeStatus('validated')).toBe('validated');
    expect((service as any).normalizeStatus('to_edit')).toBe('to_edit');
    expect((service as any).normalizeStatus('trash')).toBe('trash');
    expect((service as any).normalizeStatus('invalid')).toBe('pending');

    expect((service as any).statusLabel('all')).toBe('toutes');
    expect((service as any).statusLabel('validated')).toBe('validée');
    expect((service as any).statusLabel('to_edit')).toBe('à modifier');
    expect((service as any).statusLabel('something')).toBe('something');

    expect((service as any).back({ page: 'categories' })).toEqual({
      page: 'setup',
    });
    expect(
      (service as any).back({
        page: 'questions',
        categoryId: 'c1',
        status: 'pending',
      }),
    ).toEqual({ page: 'category', categoryId: 'c1' });

    const guardedMeta = (service as any).getMeta({ metadata: {} });
    expect(guardedMeta.adminView).toEqual({ page: 'setup' });
    expect(guardedMeta.config).toMatchObject({
      targetPoints: 20,
      timerSeconds: 30,
      interQuestionSeconds: 15,
    });
  });
});
