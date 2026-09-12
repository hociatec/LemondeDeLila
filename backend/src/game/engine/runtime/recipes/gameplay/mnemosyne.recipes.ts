import { gameInput } from '../../actions/game-input-schema';
import { thresholdVictory } from '../../automation/threshold-victory';
import { defineConfiguration } from '../../configuration/configuration-kit';
import type {
  MnemosyneConfig,
  MnemosyneProgram,
  MnemosyneSourceQuestion,
} from '../../extensions/mnemosyne/program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction } from '../../definitions/game-definition-builders';
import { defineEvent } from '../../events/game-event-definition';
import { setupPlayingPhases } from '../../kits/phase-kit';
import { quiz, type QuizQuestion } from '../../kits/quiz-kit';
import { simultaneousAnswers } from '../../patterns/gameplay-pattern-round-economy';
import { rejectRule } from '../../../../core/domain/errors/game-domain.errors';

type State = Record<string, never>;
type Context = GameContext<State>;
const SESSION = 'mnemosyne.current';
const QUESTION_TIMER = 'mnemosyne.question';
const NEXT_QUESTION_TIMER = 'mnemosyne.next-question';

export function mnemosyneRules(source: MnemosyneProgram) {
  const program = structuredClone(source);
  const categories = program.categories.map((category) => ({ ...category }));
  const questions = program.questions
    .filter((question) => question.status === 'validated')
    .map(toQuizQuestion);
  const banks = [
    { id: 'all', questions },
    ...categories.map((category) => ({
      id: category.id,
      questions: questions.filter(
        (_question, index) =>
          program.questions.filter((item) => item.status === 'validated')[index]
            ?.categoryId === category.id,
      ),
    })),
  ].filter((bank) => bank.questions.length > 0);
  const phases = setupPlayingPhases<State>();
  const categoryIds = banks.map((bank) => bank.id);
  const quizStarted = defineEvent({
    type: 'quiz.started',
    data: gameInput.object({ categoryId: gameInput.enum(categoryIds) }),
  });
  const config = defineConfiguration<State, MnemosyneConfig>({
    input: gameInput.object({
      categoryId: gameInput.enum(categoryIds),
      targetPoints: gameInput.number({ integer: true, min: 1, max: 200 }),
      useTimer: gameInput.boolean(),
      timerSeconds: gameInput.number({ integer: true, min: 5, max: 300 }),
      interQuestionSeconds: gameInput.number({
        integer: true,
        min: 0,
        max: 60,
      }),
      correctSoloPoints: gameInput.number({
        integer: true,
        min: -50,
        max: 50,
      }),
      correctMultiPoints: gameInput.number({
        integer: true,
        min: -50,
        max: 50,
      }),
      wrongPoints: gameInput.number({ integer: true, min: -50, max: 50 }),
      timeoutPoints: gameInput.number({ integer: true, min: -50, max: 50 }),
    }),
    defaults: program.defaults,
    phase: phases.initialPhase,
    permission: 'owner',
    ui: { title: 'Configuration du quiz', submitLabel: 'Démarrer le quiz' },
    onConfigured: ({ config: values, ctx }) => {
      phases.transition(ctx, 'playing');
      ctx.round.start(ctx.players.all()[0]?.id);
      quizStarted.emit(ctx, { categoryId: values.categoryId });
    },
  });
  const draw = defineAction<State, Record<string, never>>({
    input: gameInput.object({}),
    documentation: 'Pioche la question suivante de la catégorie sélectionnée.',
    available: ({ actor, ctx }) =>
      phases.is(ctx, 'playing') &&
      actor.id === ctx.round.starter() &&
      currentSession(ctx) == null &&
      (!ctx.scheduler.has(NEXT_QUESTION_TIMER) ||
        ctx.scheduler.isDue(NEXT_QUESTION_TIMER)),
    execute: ({ ctx }) => {
      const values = mnemoConfig(ctx);
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
            meta: { actorId: ctx.round.starter() },
          },
        });
      ctx.events.message('game.quiz.started', {
        sessionId: SESSION,
        questionId: session.question.id,
        round: ctx.round.number,
      });
    },
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
      if (result.allAnswered) resolveQuestion([], ctx);
    },
  });
  const timeout = defineAction<State, Record<string, never>>({
    input: gameInput.object({}),
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
    ctx.events.message('game.quiz.resolved', {
      sessionId: SESSION,
      questionId: session.question.id,
      correctPlayerIds: correctIds,
      wrongPlayerIds: wrongIds,
      timedOutPlayerIds: timedOutIds,
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
    ctx.round.end(correctIds);
    if (winnerId != null) {
      ctx.match.finish({ winners: [winnerId], reason: 'target-score' });
      return;
    }
    ctx.scheduler.schedule(NEXT_QUESTION_TIMER, {
      afterMs: values.interQuestionSeconds * 1_000,
    });
    ctx.round.next();
  }

  return {
    draw,
    answer,
    timeout,
    config,
    events: [quizStarted],
    patterns: [simultaneousAnswers<State>()],
    components: banks.map((bank) =>
      quiz.bank({ id: bank.id, questions: bank.questions, shuffle: true }),
    ),
    chooseBot: (availableActions: readonly string[], ctx: Context) => {
      if (availableActions.includes('answer'))
        return {
          recipe: 'mnemosyne-answer' as const,
          payload: { answerIndex: ctx.random.int(4) },
        };
      if (availableActions.includes('draw'))
        return { recipe: 'mnemosyne-draw' as const, payload: {} };
      if (availableActions.includes('timeout'))
        return { recipe: 'mnemosyne-timeout' as const, payload: {} };
      return null;
    },
  };
}
function mnemoConfig(ctx: Context): MnemosyneConfig {
  return ctx.config.values<MnemosyneConfig>();
}

function currentSession(ctx: Context) {
  const session = ctx.quiz.session(SESSION);
  return session?.phase === 'closed' ? null : session;
}

function toQuizQuestion(question: MnemosyneSourceQuestion): QuizQuestion {
  const choices = [
    question.correct,
    question.wrong1,
    question.wrong2,
    question.wrong3,
  ];
  const offset = stableOffset(question.id, choices.length);
  return {
    id: question.id,
    prompt: question.question,
    choices: [...choices.slice(offset), ...choices.slice(0, offset)],
    answerIndex: (choices.length - offset) % choices.length,
  };
}

function stableOffset(value: string, modulo: number): number {
  let hash = 0;
  for (const character of value)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % modulo;
}
