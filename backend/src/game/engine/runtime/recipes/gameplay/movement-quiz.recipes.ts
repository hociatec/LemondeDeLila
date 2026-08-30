import type { GameActionDefinition } from '../../definitions/game-definition';
import { defineAction } from '../../definitions/game-definition';
import { gameInput } from '../../actions/game-input-schema';

export function moveCurrentPlayer<TState extends object>(options: {
  trackId: string;
  spaces: number;
  endTurn?: boolean;
}): GameActionDefinition<TState, Record<string, never>> {
  return defineAction<TState, Record<string, never>>({
    input: gameInput.object({}),
    execute: ({ actor, ctx }) => {
      ctx.movement.move(options.trackId, actor.id, options.spaces);
      if (options.endTurn ?? true) ctx.turn.end();
    },
    documentation: 'Déplace le pion du joueur courant.',
  });
}

export function movePawn<TState extends object>(options: {
  trackId: string;
  enumerate: GameActionDefinition<
    TState,
    { playerId: number; distance: number }
  >['enumerate'];
  validate?: GameActionDefinition<
    TState,
    { playerId: number; distance: number }
  >['validate'];
  afterMove?: (input: {
    state: TState;
    playerId: number;
    distance: number;
    position: number;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
  endTurn?: boolean;
}): GameActionDefinition<TState, { playerId: number; distance: number }> {
  return defineAction<TState, { playerId: number; distance: number }>({
    input: gameInput.object({
      playerId: gameInput.playerId(),
      distance: gameInput.number({ integer: true }),
    }),
    enumerate: options.enumerate,
    validate:
      options.validate ??
      (({ input, ctx }) => ctx.players.get(input.playerId) != null),
    execute: ({ state, input, ctx }) => {
      const position = ctx.movement.move(
        options.trackId,
        input.playerId,
        input.distance,
      );
      options.afterMove?.({
        state,
        playerId: input.playerId,
        distance: input.distance,
        position,
        ctx,
      });
      if (options.endTurn ?? true) ctx.turn.complete();
    },
    documentation: 'Déplace un pion autorisé sur une piste déclarée.',
  });
}

export function leaveRound<TState extends object>(): GameActionDefinition<
  TState,
  Record<string, never>
> {
  return defineAction<TState, Record<string, never>>({
    input: gameInput.object({}),
    execute: ({ actor, ctx }) => {
      ctx.round.leave(actor.id);
      ctx.turn.end();
    },
    documentation: 'Quitte la manche courante.',
  });
}

export function skipTurn<TState extends object>(
  options: {
    count?: number;
  } = {},
): GameActionDefinition<TState, { targetPlayerId: number }> {
  return defineAction<TState, { targetPlayerId: number }>({
    input: gameInput.object({ targetPlayerId: gameInput.playerId() }),
    validate: ({ input, ctx }) => ctx.players.get(input.targetPlayerId) != null,
    enumerate: ({ actor, ctx }) =>
      ctx.players
        .others(actor.id)
        .map((player) => ({ targetPlayerId: player.id })),
    execute: ({ input, ctx }) =>
      ctx.turn.skip(input.targetPlayerId, options.count ?? 1),
    documentation: 'Programme un ou plusieurs tours passés.',
  });
}

export function chooseTarget<TState extends object>(options: {
  targets: (input: {
    state: TState;
    playerId: number;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => readonly number[];
  available?: GameActionDefinition<
    TState,
    { targetPlayerId: number }
  >['available'];
  execute: (input: {
    state: TState;
    playerId: number;
    targetPlayerId: number;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
  documentation?: string;
  endTurn?: boolean;
}): GameActionDefinition<TState, { targetPlayerId: number }> {
  const targetsFor = (
    state: TState,
    playerId: number,
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'],
  ) => options.targets({ state, playerId, ctx });
  return defineAction<TState, { targetPlayerId: number }>({
    input: gameInput.object({ targetPlayerId: gameInput.playerId() }),
    available: options.available,
    validate: ({ state, actor, input, ctx }) =>
      input.targetPlayerId !== actor.id &&
      targetsFor(state, actor.id, ctx).includes(input.targetPlayerId),
    enumerate: ({ state, actor, ctx }) =>
      targetsFor(state, actor.id, ctx).map((targetPlayerId) => ({
        targetPlayerId,
      })),
    execute: ({ state, actor, input, ctx }) => {
      options.execute({
        state,
        playerId: actor.id,
        targetPlayerId: input.targetPlayerId,
        ctx,
      });
      if (options.endTurn) ctx.turn.complete();
    },
    documentation:
      options.documentation ?? 'Choisit une cible légale puis résout l’effet.',
  });
}

type AnswerQuizOptions<TState extends object> = {
  sessionId:
    | string
    | ((input: {
        state: TState;
        playerId: number;
        ctx: Parameters<
          GameActionDefinition<TState, never>['execute']
        >[0]['ctx'];
      }) => string);
  available?: GameActionDefinition<
    TState,
    { answerIndex: number }
  >['available'];
  afterAnswer?: (input: {
    state: TState;
    playerId: number;
    answerIndex: number;
    correct: boolean;
    allAnswered: boolean;
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'];
  }) => void;
  endTurn?: boolean;
};

export function answerQuiz<TState extends object>(
  options: AnswerQuizOptions<TState>,
): GameActionDefinition<TState, { answerIndex: number }> {
  const sessionIdFor = (
    state: TState,
    playerId: number,
    ctx: Parameters<GameActionDefinition<TState, never>['execute']>[0]['ctx'],
  ) =>
    typeof options.sessionId === 'string'
      ? options.sessionId
      : options.sessionId({ state, playerId, ctx });
  return defineAction<TState, { answerIndex: number }>({
    input: gameInput.object({
      answerIndex: gameInput.number({ integer: true, min: 0 }),
    }),
    available: (input) => {
      if (options.available && !options.available(input)) return false;
      const session = input.ctx.quiz.session(
        sessionIdFor(input.state, input.actor.id, input.ctx),
      );
      return (
        session?.phase === 'answering' &&
        session.participantPlayerIds.includes(input.actor.id) &&
        session.answers[String(input.actor.id)] == null
      );
    },
    validate: ({ state, actor, input, ctx }) => {
      const session = ctx.quiz.session(sessionIdFor(state, actor.id, ctx));
      return (
        session != null &&
        input.answerIndex >= 0 &&
        input.answerIndex < session.question.choices.length
      );
    },
    enumerate: ({ state, actor, ctx }) => {
      const session = ctx.quiz.session(sessionIdFor(state, actor.id, ctx));
      return (
        session?.question.choices.map((_choice, answerIndex) => ({
          answerIndex,
        })) ?? []
      );
    },
    execute: ({ state, actor, input, ctx }) => {
      const result = ctx.quiz.answer(
        sessionIdFor(state, actor.id, ctx),
        actor.id,
        input.answerIndex,
      );
      options.afterAnswer?.({
        state,
        playerId: actor.id,
        answerIndex: input.answerIndex,
        correct: result.correct,
        allAnswered: result.allAnswered,
        ctx,
      });
      if (options.endTurn) ctx.turn.complete();
    },
    documentation: 'Répond à une session QuizKit active.',
  });
}
