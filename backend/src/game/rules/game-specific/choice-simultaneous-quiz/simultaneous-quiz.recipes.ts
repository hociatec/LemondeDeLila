import {
  gameInput,
  thresholdVictory,
  defineConfiguration,
  defineEvent,
  setupPlayingPhases,
  quiz,
  simultaneousAnswers,
} from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import { quizCatalog } from './simultaneous-quiz.catalog';
import type {
  SimultaneousQuizConfig,
  SimultaneousQuizProgram,
} from './program';
import {
  defineAction,
  defineEmptyAction,
} from '../../../engine/runtime/definitions/game-definition-builders';
import { rejectRule } from '../../../core/domain/errors/game-domain.errors';

type State = Record<string, never>;
type Context = GameContext<State>;
const SESSION = 'choice-simultaneous-quiz.current';
const QUESTION_TIMER = 'choice-simultaneous-quiz.question';
const NEXT_QUESTION_TIMER = 'choice-simultaneous-quiz.next-question';
const QUESTIONS_IN_ROUND_COUNTER =
  'choice-simultaneous-quiz.questions-in-round';

export function simultaneousQuizRules(source: SimultaneousQuizProgram) {
  const program = structuredClone(source);
  const { banks, categoryIds, categoryLabels } = quizCatalog(program);
  const phases = setupPlayingPhases<State>();
  const quizStarted = defineEvent({
    type: 'quiz.started',
    data: gameInput.object({
      categoryId: gameInput.enum(categoryIds, { labels: categoryLabels }),
    }),
  });
  const config = defineConfiguration<State, SimultaneousQuizConfig>({
    input: quizConfigurationInput(categoryIds, categoryLabels),
    defaults: program.defaults,
    phase: phases.initialPhase,
    permission: 'owner',
    ui: { title: 'Configuration du quiz', submitLabel: 'Démarrer le quiz' },
    onConfigured: ({ config: values, ctx }) => {
      phases.transition(ctx, 'playing');
      ctx.counters.set(QUESTIONS_IN_ROUND_COUNTER, 0);
      ctx.round.start(ctx.players.all()[0]?.id);
      const starterId = ctx.round.starter();
      if (starterId != null) ctx.turn.to(starterId, { announce: false });
      quizStarted.emit(ctx, { categoryId: values.categoryId });
      askQuestion(ctx);
    },
  });
  const draw = defineEmptyAction<State>({
    documentation: 'Pioche la question suivante de la catégorie sélectionnée.',
    available: ({ actor, ctx }) =>
      phases.is(ctx, 'playing') &&
      ctx.turn.is(actor.id) &&
      currentSession(ctx) == null &&
      (!ctx.scheduler.has(NEXT_QUESTION_TIMER) ||
        ctx.scheduler.isDue(NEXT_QUESTION_TIMER)),
    execute: ({ ctx }) => askQuestion(ctx),
  });
  const answer = defineAction<State, { answerIndex: number }>({
    input: gameInput.object({
      answerIndex: gameInput.number({ integer: true, min: 0, max: 3 }),
    }),
    documentation: 'Répond une fois à la question en cours.',
    available: ({ actor, ctx }) => {
      const session = currentSession(ctx);
      return (
        session != null &&
        session.phase === 'answering' &&
        session.answers[String(actor.id)] == null &&
        !ctx.scheduler.isDue(QUESTION_TIMER)
      );
    },
    validate: ({ input, ctx }) =>
      input.answerIndex >= 0 &&
      input.answerIndex < (currentSession(ctx)?.question.choices.length ?? 0),
    enumerate: ({ ctx }) =>
      currentSession(ctx)?.question.choices.map((_choice, answerIndex) => ({
        answerIndex,
      })) ?? [],
    execute: ({ actor, input, ctx }) => {
      const result = ctx.quiz.answer(SESSION, actor.id, input.answerIndex);
      ctx.events.message('game.quiz.answer-recorded', { playerId: actor.id });
      if (result.allAnswered) resolveQuestion([], ctx);
    },
  });
  const timeout = defineEmptyAction<State>({
    documentation: 'Clôture une question dont le délai est dépassé.',
    available: ({ ctx }) =>
      currentSession(ctx)?.phase === 'answering' &&
      ctx.scheduler.isDue(QUESTION_TIMER),
    execute: ({ ctx }) => {
      const session = currentSession(ctx);
      const timedOut =
        session?.participantPlayerIds.filter(
          (id) => session.answers[String(id)] == null,
        ) ?? [];
      resolveQuestion(timedOut, ctx);
    },
  });
  const ready = defineEmptyAction<State>({
    documentation:
      'Affiche automatiquement la question suivante après la pause.',
    available: ({ ctx }) =>
      phases.is(ctx, 'playing') &&
      currentSession(ctx) == null &&
      ctx.scheduler.has(NEXT_QUESTION_TIMER) &&
      ctx.scheduler.isDue(NEXT_QUESTION_TIMER),
    execute: ({ ctx }) => askQuestion(ctx),
  });

  function askQuestion(ctx: Context): void {
    const values = mnemoConfig(ctx);
    ctx.counters.add(QUESTIONS_IN_ROUND_COUNTER, 1);
    const session = ctx.quiz.ask(
      values.categoryId,
      ctx.players.all().map((player) => player.id),
      { sessionId: SESSION },
    );
    if (!session) rejectRule('Le stock de questions Mnémosyne est épuisé');
    ctx.scheduler.cancel(NEXT_QUESTION_TIMER);
    if (values.useTimer)
      ctx.scheduler.schedule(QUESTION_TIMER, {
        afterMs: values.timerSeconds * 1_000,
        action: {
          type: 'timeout',
          payload: {},
          meta: { actorId: ctx.players.current()?.id },
        },
      });
    ctx.events.message('game.quiz.started', {
      sessionId: SESSION,
      questionId: session.question.id,
      round: ctx.round.number,
      playerId: ctx.players.current()?.id,
    });
  }

  function resolveQuestion(timedOutIds: number[], ctx: Context): void {
    const session = ctx.quiz.reveal(SESSION);
    const answeredIds = session.participantPlayerIds.filter((id) =>
      Object.hasOwn(session.answers, String(id)),
    );
    const correctIds = answeredIds.filter(
      (id) => session.answers[String(id)] === session.correctAnswerIndex,
    );
    const wrongIds = answeredIds.filter(
      (id) => session.answers[String(id)] !== session.correctAnswerIndex,
    );
    const values = mnemoConfig(ctx);
    const correctPoints =
      correctIds.length === 1
        ? values.correctSoloPoints
        : values.correctMultiPoints;
    for (const id of correctIds) ctx.score.add(id, correctPoints);
    for (const id of wrongIds) ctx.score.add(id, values.wrongPoints);
    for (const id of timedOutIds) ctx.score.add(id, values.timeoutPoints);
    const correctAnswer =
      session.correctAnswerIndex == null
        ? ''
        : (session.question.choices[session.correctAnswerIndex] ?? '');
    ctx.events.message('game.quiz.resolved', {
      sessionId: SESSION,
      questionId: session.question.id,
      correctPlayerIds: correctIds,
      wrongPlayerIds: wrongIds,
      timedOutPlayerIds: timedOutIds,
      correctAnswer,
      results: session.participantPlayerIds.map((playerId) => {
        const answerIndex = session.answers[String(playerId)];
        if (answerIndex === session.correctAnswerIndex)
          return {
            playerId,
            outcome: 'correct',
            answer: session.question.choices[answerIndex],
            points: correctPoints,
          };
        if (answerIndex != null)
          return {
            playerId,
            outcome: 'wrong',
            answer: session.question.choices[answerIndex],
            points: values.wrongPoints,
          };
        return {
          playerId,
          outcome: 'timeout',
          points: values.timeoutPoints,
        };
      }),
    });
    const outcome = thresholdVictory<State>({
      kind: 'score-at-least',
      amount: values.targetPoints,
      participants: 'all',
      selection: 'highest-value-lowest-id',
      reason: 'target-score',
    }).evaluate({ state: {}, ctx });
    ctx.quiz.close(SESSION);
    ctx.scheduler.cancel(QUESTION_TIMER);
    const winnerId = outcome?.winnerPlayerIds[0];
    if (winnerId != null) {
      ctx.match.finish({ winners: [winnerId], reason: 'target-score' });
      return;
    }
    if (
      ctx.counters.get(QUESTIONS_IN_ROUND_COUNTER) >= questionsPerRound(values)
    ) {
      ctx.counters.set(QUESTIONS_IN_ROUND_COUNTER, 0);
      ctx.round.end();
      ctx.round.next();
      const starterId = ctx.round.starter();
      if (starterId != null) ctx.turn.to(starterId);
    } else {
      const nextPlayerId = nextDrawerId(ctx);
      if (nextPlayerId != null) ctx.turn.to(nextPlayerId);
    }
    if (values.interQuestionSeconds > 0)
      ctx.scheduler.schedule(NEXT_QUESTION_TIMER, {
        afterMs: values.interQuestionSeconds * 1_000,
        action: {
          type: 'ready',
          payload: {},
          meta: { actorId: ctx.players.current()?.id },
        },
        visibility: { kind: 'internal' },
      });
    else askQuestion(ctx);
  }

  return {
    draw,
    answer,
    timeout,
    ready,
    config,
    events: [quizStarted],
    patterns: [simultaneousAnswers<State>()],
    components: quizComponents(banks),
    chooseBot: (availableActions: readonly string[], ctx: Context) => {
      if (availableActions.includes('answer'))
        return {
          recipe: 'choice-simultaneous-quiz-answer' as const,
          payload: { answerIndex: ctx.random.int(4) },
        };
      if (availableActions.includes('draw'))
        return {
          recipe: 'choice-simultaneous-quiz-draw' as const,
          payload: {},
        };
      if (availableActions.includes('timeout'))
        return {
          recipe: 'choice-simultaneous-quiz-timeout' as const,
          payload: {},
        };
      return null;
    },
  };
}
function mnemoConfig(ctx: Context): SimultaneousQuizConfig {
  return ctx.config.values<SimultaneousQuizConfig>();
}

function questionsPerRound(config: SimultaneousQuizConfig): number {
  const value = Number(config.questionsPerRound);
  return Number.isSafeInteger(value) && value >= 1 && value <= 50 ? value : 5;
}

function nextDrawerId(ctx: Context): number | null {
  const players = ctx.players.active();
  if (players.length === 0) return null;
  const currentId = ctx.players.current()?.id;
  const currentIndex = players.findIndex((player) => player.id === currentId);
  return players[(Math.max(0, currentIndex) + 1) % players.length]?.id ?? null;
}

function currentSession(ctx: Context) {
  const session = ctx.quiz.session(SESSION);
  return session?.phase === 'closed' ? null : session;
}

function quizComponents(banks: ReturnType<typeof quizCatalog>['banks']) {
  return banks.map((bank) =>
    quiz.bank({
      id: bank.id,
      questions: bank.questions,
      shuffle: true,
      repeat: true,
      shuffleChoices: true,
    }),
  );
}

function quizConfigurationInput(
  categoryIds: string[],
  categoryLabels: Record<string, string>,
) {
  return gameInput.object({
    categoryId: gameInput.label(
      'Catégorie de questions',
      gameInput.enum(categoryIds, { labels: categoryLabels }),
    ),
    questionsPerRound: gameInput.label(
      'Questions par manche',
      gameInput.number({ integer: true, min: 1, max: 50 }),
    ),
    targetPoints: gameInput.label(
      'Score à atteindre',
      gameInput.number({ integer: true, min: 1, max: 200 }),
    ),
    useTimer: gameInput.label('Utiliser un chronomètre', gameInput.boolean()),
    timerSeconds: gameInput.label(
      'Durée d’une question (secondes)',
      gameInput.number({ integer: true, min: 5, max: 300 }),
    ),
    interQuestionSeconds: gameInput.label(
      'Pause entre deux questions (secondes)',
      gameInput.number({ integer: true, min: 0, max: 60 }),
    ),
    correctSoloPoints: gameInput.label(
      'Points si une seule bonne réponse',
      gameInput.number({ integer: true, min: -50, max: 50 }),
    ),
    correctMultiPoints: gameInput.label(
      'Points si plusieurs bonnes réponses',
      gameInput.number({ integer: true, min: -50, max: 50 }),
    ),
    wrongPoints: gameInput.label(
      'Points en cas de mauvaise réponse',
      gameInput.number({ integer: true, min: -50, max: 50 }),
    ),
    timeoutPoints: gameInput.label(
      'Points en cas de temps écoulé',
      gameInput.number({ integer: true, min: -50, max: 50 }),
    ),
  });
}
