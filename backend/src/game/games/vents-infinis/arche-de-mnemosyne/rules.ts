import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import { MNEMO_BANKS } from './content';
import type { MnemoConfig, MnemoState } from './state';

type RuleContext = GameRuleContext<MnemoState>;

const configureInput = gameInput.object({
  targetPoints: gameInput.optional(
    gameInput.number({ integer: true, min: 1, max: 200 }),
  ),
  useTimer: gameInput.optional(gameInput.boolean()),
  timerSeconds: gameInput.optional(
    gameInput.number({ integer: true, min: 5, max: 300 }),
  ),
  interQuestionSeconds: gameInput.optional(
    gameInput.number({ integer: true, min: 0, max: 60 }),
  ),
  correctSoloPoints: gameInput.optional(
    gameInput.number({ integer: true, min: -50, max: 50 }),
  ),
  correctMultiPoints: gameInput.optional(
    gameInput.number({ integer: true, min: -50, max: 50 }),
  ),
  wrongPoints: gameInput.optional(
    gameInput.number({ integer: true, min: -50, max: 50 }),
  ),
  timeoutPoints: gameInput.optional(
    gameInput.number({ integer: true, min: -50, max: 50 }),
  ),
});

export const configure = defineAction<MnemoState, Partial<MnemoConfig>>({
  input: configureInput,
  documentation: 'Configure le score et les délais avant le début du quiz.',
  available: ({ state, actor, ctx }) =>
    actor.id === state.ownerId && ctx.phase() === 'setup',
  execute: ({ state, input }) => {
    state.config = {
      targetPoints: input.targetPoints ?? state.config.targetPoints,
      useTimer: input.useTimer ?? state.config.useTimer,
      timerSeconds: input.timerSeconds ?? state.config.timerSeconds,
      interQuestionSeconds:
        input.interQuestionSeconds ?? state.config.interQuestionSeconds,
      correctSoloPoints:
        input.correctSoloPoints ?? state.config.correctSoloPoints,
      correctMultiPoints:
        input.correctMultiPoints ?? state.config.correctMultiPoints,
      wrongPoints: input.wrongPoints ?? state.config.wrongPoints,
      timeoutPoints: input.timeoutPoints ?? state.config.timeoutPoints,
    };
  },
});

export const selectCategory = defineAction<MnemoState, { categoryId: string }>({
  input: gameInput.object({
    categoryId: gameInput.string({ min: 1, max: 128 }),
  }),
  documentation: 'Choisit une catégorie ou le mélange de toutes les questions.',
  available: ({ state, actor, ctx }) =>
    actor.id === state.ownerId && ctx.phase() === 'setup',
  availableInputs: () => MNEMO_BANKS.map((bank) => ({ categoryId: bank.id })),
  execute: ({ state, input, ctx }) => {
    if (!MNEMO_BANKS.some((bank) => bank.id === input.categoryId))
      throw new Error('Catégorie Mnémosyne invalide');
    state.categoryId = input.categoryId;
    ctx.transitionTo('playing');
    ctx.history.add('Le quiz Mnémosyne commence.');
  },
});

export const draw = defineAction<MnemoState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Pioche la question suivante de la catégorie sélectionnée.',
  available: ({ state, actor, ctx }) =>
    ctx.phase() === 'playing' &&
    actor.id === state.questionLeaderId &&
    state.currentQuestion == null &&
    (state.notBeforeMs == null || ctx.clock.nowMs() >= state.notBeforeMs),
  execute: ({ state, ctx }) => {
    const bankId = state.categoryId ?? 'all';
    const question = ctx.quiz.next(bankId);
    if (!question)
      throw new Error('Le stock de questions Mnémosyne est épuisé');
    state.currentQuestion = question;
    state.correctnessByPlayerId = {};
    state.answeredPlayerIds = [];
    state.notBeforeMs = null;
    state.deadlineMs = state.config.useTimer
      ? ctx.clock.nowMs() + state.config.timerSeconds * 1_000
      : null;
    ctx.history.add(`Question ${state.roundNumber} : ${question.prompt}`);
  },
});

export const answer = defineAction<MnemoState, { answerIndex: number }>({
  input: gameInput.object({
    answerIndex: gameInput.number({ integer: true, min: 0, max: 3 }),
  }),
  documentation: 'Répond une fois à la question en cours.',
  available: ({ state, actor, ctx }) =>
    state.currentQuestion != null &&
    !state.answeredPlayerIds.includes(actor.id) &&
    (state.deadlineMs == null || ctx.clock.nowMs() <= state.deadlineMs),
  availableInputs: ({ state }) =>
    state.currentQuestion?.choices.map((_choice, answerIndex) => ({
      answerIndex,
    })) ?? [],
  execute: ({ state, actor, input, ctx }) => {
    const question = state.currentQuestion;
    if (!question) throw new Error('Question Mnémosyne absente');
    state.correctnessByPlayerId[actor.id] = ctx.quiz.check(
      state.categoryId ?? 'all',
      question.id,
      input.answerIndex,
    );
    state.answeredPlayerIds.push(actor.id);
    if (state.answeredPlayerIds.length === ctx.players.all().length)
      resolveQuestion(state, [], ctx);
  },
});

export const timeout = defineAction<MnemoState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Clôture une question dont le délai est dépassé.',
  available: ({ state, ctx }) =>
    state.currentQuestion != null &&
    state.deadlineMs != null &&
    ctx.clock.nowMs() >= state.deadlineMs,
  execute: ({ state, ctx }) => {
    const timedOut = ctx.players
      .all()
      .map((player) => player.id)
      .filter((id) => !state.answeredPlayerIds.includes(id));
    resolveQuestion(state, timedOut, ctx);
  },
});

export const MNEMO_ACTIONS = {
  selectCategory,
  configure,
  draw,
  answer,
  timeout,
};

function resolveQuestion(
  state: MnemoState,
  timedOutIds: number[],
  ctx: RuleContext,
): void {
  const players = ctx.players.all();
  const correctIds = players
    .map((player) => player.id)
    .filter((id) => state.correctnessByPlayerId[id] === true);
  const wrongIds = state.answeredPlayerIds.filter(
    (id) => state.correctnessByPlayerId[id] !== true,
  );
  const correctPoints =
    correctIds.length === 1
      ? state.config.correctSoloPoints
      : state.config.correctMultiPoints;
  for (const id of correctIds) state.scores[id] += correctPoints;
  for (const id of wrongIds) state.scores[id] += state.config.wrongPoints;
  for (const id of timedOutIds) state.scores[id] += state.config.timeoutPoints;
  ctx.history.add(resultMessage(correctIds, wrongIds, timedOutIds, ctx));

  const reached = players
    .map((player) => ({ id: player.id, score: state.scores[player.id] }))
    .filter(({ score }) => score >= state.config.targetPoints)
    .sort((left, right) => right.score - left.score || left.id - right.id);
  state.winnerId = reached[0]?.id ?? null;
  state.currentQuestion = null;
  state.correctnessByPlayerId = {};
  state.answeredPlayerIds = [];
  state.deadlineMs = null;
  if (state.winnerId != null) return;
  state.notBeforeMs =
    ctx.clock.nowMs() + state.config.interQuestionSeconds * 1_000;
  state.roundNumber += 1;
  const currentIndex = players.findIndex(
    (player) => player.id === state.questionLeaderId,
  );
  state.questionLeaderId = players[(currentIndex + 1) % players.length].id;
}

function resultMessage(
  correctIds: number[],
  wrongIds: number[],
  timedOutIds: number[],
  ctx: RuleContext,
): string {
  const names = (ids: number[]) =>
    ids.map((id) => ctx.players.get(id)?.username ?? `Joueur ${id}`).join(', ');
  return [
    correctIds.length > 0
      ? `Bonnes réponses : ${names(correctIds)}.`
      : 'Aucune bonne réponse.',
    wrongIds.length > 0 ? `Mauvaises réponses : ${names(wrongIds)}.` : '',
    timedOutIds.length > 0 ? `Temps écoulé : ${names(timedOutIds)}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}
