import {
  rejectRule,
  defineAction,
  gameInput,
  setupPlayingPhases,
} from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import type { MnemoGameConfig, MnemoState } from './state';

type RuleContext = GameContext<MnemoState>;
export const MNEMO_PHASES = setupPlayingPhases<MnemoState>();
export const MNEMO_SESSION = 'mnemosyne.current';
export const MNEMO_QUESTION_TIMER = 'mnemosyne.question';
export const MNEMO_NEXT_QUESTION_TIMER = 'mnemosyne.next-question';

export const draw = defineAction<MnemoState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Pioche la question suivante de la catégorie sélectionnée.',
  available: ({ state, actor, ctx }) =>
    MNEMO_PHASES.is(ctx, 'playing') &&
    actor.id === ctx.round.starter() &&
    currentSession(ctx) == null &&
    (!ctx.scheduler.has(MNEMO_NEXT_QUESTION_TIMER) ||
      ctx.scheduler.isDue(MNEMO_NEXT_QUESTION_TIMER)),
  execute: ({ state, ctx }) => {
    const config = mnemoConfig(ctx);
    const bankId = config.categoryId;
    const session = ctx.quiz.ask(
      bankId,
      ctx.players.all().map((player) => player.id),
      { sessionId: MNEMO_SESSION },
    );
    if (!session) rejectRule('Le stock de questions Mnémosyne est épuisé');
    ctx.scheduler.cancel(MNEMO_NEXT_QUESTION_TIMER);
    if (config.useTimer) {
      ctx.scheduler.schedule(MNEMO_QUESTION_TIMER, {
        afterMs: config.timerSeconds * 1_000,
        action: {
          type: 'timeout',
          payload: {},
          meta: { actorId: ctx.round.starter() },
        },
      });
    }
    ctx.events.message('game.quiz.started', {
      sessionId: MNEMO_SESSION,
      questionId: session.question.id,
      round: ctx.round.number,
    });
  },
});

export const answer = defineAction<MnemoState, { answerIndex: number }>({
  input: gameInput.object({
    answerIndex: gameInput.number({ integer: true, min: 0, max: 3 }),
  }),
  documentation: 'Répond une fois à la question en cours.',
  available: ({ state, actor, ctx }) => {
    const session = currentSession(ctx);
    return (
      session != null &&
      session.phase === 'answering' &&
      session.answers[String(actor.id)] == null &&
      !ctx.scheduler.isDue(MNEMO_QUESTION_TIMER)
    );
  },
  validate: ({ input, ctx }) =>
    input.answerIndex >= 0 &&
    input.answerIndex < (currentSession(ctx)?.question.choices.length ?? 0),
  enumerate: ({ ctx }) =>
    currentSession(ctx)?.question.choices.map((_choice, answerIndex) => ({
      answerIndex,
    })) ?? [],
  execute: ({ state, actor, input, ctx }) => {
    const result = ctx.quiz.answer(
      MNEMO_SESSION,
      actor.id,
      input.answerIndex,
    );
    if (result.allAnswered) resolveQuestion([], ctx);
  },
});

export const timeout = defineAction<MnemoState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Clôture une question dont le délai est dépassé.',
  available: ({ ctx }) =>
    currentSession(ctx)?.phase === 'answering' &&
    ctx.scheduler.isDue(MNEMO_QUESTION_TIMER),
  execute: ({ state, ctx }) => {
    const session = currentSession(ctx);
    const timedOut =
      session?.participantPlayerIds.filter(
        (id) => session.answers[String(id)] == null,
      ) ?? [];
    resolveQuestion(timedOut, ctx);
  },
});

export const MNEMO_ACTIONS = {
  draw,
  answer,
  timeout,
};

function resolveQuestion(timedOutIds: number[], ctx: RuleContext): void {
  const players = ctx.players.all();
  const session = ctx.quiz.reveal(MNEMO_SESSION);
  const answeredIds = Object.keys(session.answers).map(Number);
  const correctIds = answeredIds.filter(
    (id) => session.answers[String(id)] === session.correctAnswerIndex,
  );
  const wrongIds = answeredIds.filter(
    (id) => session.answers[String(id)] !== session.correctAnswerIndex,
  );
  const config = mnemoConfig(ctx);
  const correctPoints =
    correctIds.length === 1
      ? config.correctSoloPoints
      : config.correctMultiPoints;
  for (const id of correctIds) ctx.score.add(id, correctPoints);
  for (const id of wrongIds) ctx.score.add(id, config.wrongPoints);
  for (const id of timedOutIds) ctx.score.add(id, config.timeoutPoints);
  ctx.events.message('game.quiz.resolved', {
    sessionId: MNEMO_SESSION,
    questionId: session.question.id,
    correctPlayerIds: correctIds,
    wrongPlayerIds: wrongIds,
    timedOutPlayerIds: timedOutIds,
  });

  const reached = players
    .map((player) => ({ id: player.id, score: ctx.score.get(player.id) }))
    .filter(({ score }) => score >= config.targetPoints)
    .sort((left, right) => right.score - left.score || left.id - right.id);
  ctx.quiz.close(MNEMO_SESSION);
  ctx.scheduler.cancel(MNEMO_QUESTION_TIMER);
  const winnerId = reached[0]?.id;
  ctx.round.end(correctIds);
  if (winnerId != null) {
    ctx.match.finish({ winners: [winnerId], reason: 'target-score' });
    return;
  }
  ctx.scheduler.schedule(MNEMO_NEXT_QUESTION_TIMER, {
    afterMs: config.interQuestionSeconds * 1_000,
  });
  ctx.round.next();
}

function mnemoConfig(ctx: RuleContext): MnemoGameConfig {
  return ctx.config.values<MnemoGameConfig>();
}

function currentSession(ctx: RuleContext) {
  const session = ctx.quiz.session(MNEMO_SESSION);
  return session?.phase === 'closed' ? null : session;
}
