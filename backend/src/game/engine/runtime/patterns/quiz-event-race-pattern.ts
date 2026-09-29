import { defineChoice } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import { GameRuleViolationError } from '../contracts/game-domain.errors';
import type { GameContext } from '../definitions/game-author-context';
import {
  defineEffect,
  drawAndResolve,
  drawEvent,
  raceTurn,
} from './pattern-capabilities';
import { definePattern } from './gameplay-pattern-core';

export type QuizEventRaceTile = {
  n: number;
  title: string;
  description?: string;
  type:
    | 'start'
    | 'neutral'
    | 'question'
    | 'challenge'
    | 'event'
    | 'move'
    | 'skip'
    | 'finish'
    | 'swapNearest'
    | 'goto';
  delta?: number;
  turnsToSkip?: number;
  target?: number;
  keepTurn?: boolean;
};
export type QuizEventChoiceCard = {
  id: number;
  title: string;
  prompt: string;
  choices: readonly string[];
  correctIndex: number;
  correctDelta: number;
  wrongDelta: number;
};
export type QuizEventEventCard = {
  id: number;
  title: string;
  description: string;
  effects: readonly GameEffectInstruction[];
  moveDeltas?: readonly number[];
};
export type QuizEventRaceOptions = {
  rollRecipe: string;
  trackId: string;
  diceId: string;
  finishReason: string;
  questionDeckId: string;
  challengeDeckId: string;
  eventDeckId: string;
  answerChoiceId: string;
  eventMoveChoiceId: string;
  tiles: readonly QuizEventRaceTile[];
  questions: readonly QuizEventChoiceCard[];
  challenges: readonly QuizEventChoiceCard[];
  events: readonly QuizEventEventCard[];
  maxDepth: number;
};

type State = Record<string, never>;
type Context = GameContext<State>;
type Pending =
  | {
      kind: 'answer';
      actorId: number;
      deck: 'questions' | 'challenges';
      cardId: number;
    }
  | { kind: 'event-move'; actorId: number; cardId: number };
type Move = (
  playerId: number,
  delta: number,
  depth: number,
  ctx: Context,
) => void;

export function quizEventRace(source: QuizEventRaceOptions) {
  const program = structuredClone(source);
  const move: Move = (playerId, delta, depth, ctx) =>
    ctx.movement.moveAndResolve({
      trackId: program.trackId,
      playerId,
      distance: delta,
      tiles: program.tiles,
      depth: depth + 1,
      maxDepth: program.maxDepth,
      blocked: () =>
        ctx.choice.current() != null || ctx.match.lifecycle() === 'finished',
      onLand: () => resolveTile(move, playerId, depth + 1, ctx),
    });
  return definePattern({
    id: `quiz-event-race:${program.trackId}`,
    mechanics: ['race', 'quiz', 'cards', 'effects'],
    actions: {
      [program.rollRecipe]: raceTurn<State>({
        trackId: program.trackId,
        diceId: program.diceId,
        resolveLanding: ({ playerId, ctx }) =>
          resolveTile(move, playerId, 0, ctx),
        documentation: 'Lance le dé et résout entièrement la case galactique.',
      }),
    },
    choices: choices(move),
    effects: effects(move),
    bot: {
      choose: ({ availableActions }) =>
        availableActions.includes(program.rollRecipe)
          ? { type: program.rollRecipe, payload: {} }
          : null,
    },
  });

  function choices(move: Move) {
    return {
      [program.answerChoiceId]: defineChoice<State, number>({
        input: gameInput.number({ integer: true, min: 0 }),
        resolve: ({ value, ctx }) => {
          const pending = ctx.choice.consumeContinuation<Pending>();
          if (!pending || pending.kind !== 'answer')
            throw new GameRuleViolationError('MISSION_ANSWER_MISSING');
          const source =
            pending.deck === 'questions'
              ? program.questions
              : program.challenges;
          const card = source.find(
            (candidate) => candidate.id === pending.cardId,
          );
          if (!card) throw new GameRuleViolationError('MISSION_CARD_UNKNOWN');
          move(
            pending.actorId,
            value === card.correctIndex ? card.correctDelta : card.wrongDelta,
            0,
            ctx,
          );
          ctx.turn.complete();
        },
      }),
      [program.eventMoveChoiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ value, ctx }) => {
          const pending = ctx.choice.consumeContinuation<Pending>();
          if (!pending || pending.kind !== 'event-move')
            throw new GameRuleViolationError('MISSION_EVENT_MOVE_MISSING');
          const card = program.events.find(
            (candidate) => candidate.id === pending.cardId,
          );
          if (!card?.moveDeltas)
            throw new GameRuleViolationError('MISSION_EVENT_UNKNOWN');
          const selected = moveOptions(card.moveDeltas, ctx).find(
            (candidate) => encode(candidate) === value,
          );
          if (!selected)
            throw new GameRuleViolationError('MISSION_MOVE_INVALID');
          move(selected.targetId, selected.delta, 0, ctx);
          ctx.turn.complete();
        },
      }),
    };
  }

  function effects(move: Move) {
    return {
      'race-quiz-event-track.move': defineEffect<State, { delta: number }>({
        input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
        apply: ({ actorPlayerId, data, ctx }) => {
          if (actorPlayerId != null) move(actorPlayerId, data.delta, 0, ctx);
        },
      }),
      'race-quiz-event-track.goto': defineEffect<State, { target: number }>({
        input: gameInput.object({
          target: gameInput.number({ integer: true, min: 1 }),
        }),
        apply: ({ actorPlayerId, data, ctx }) => {
          if (actorPlayerId == null) return;
          ctx.movement.moveTo(program.trackId, actorPlayerId, data.target - 1);
          resolveTile(move, actorPlayerId, 0, ctx);
        },
      }),
      'race-quiz-event-track.choose-player-move': defineEffect<
        State,
        { cardId: number; deltas: number[] }
      >({
        input: gameInput.object({
          cardId: gameInput.number({ integer: true, min: 1 }),
          deltas: gameInput.array(gameInput.number({ integer: true }), {
            min: 1,
          }),
        }),
        apply: ({ actorPlayerId, data, ctx }) => {
          if (actorPlayerId != null)
            requestMove(actorPlayerId, data.cardId, data.deltas, ctx);
        },
      }),
    };
  }

  function resolveTile(
    move: Move,
    playerId: number,
    depth: number,
    ctx: Context,
  ): void {
    ctx.movement.resolveLanding({
      trackId: program.trackId,
      playerId,
      tiles: program.tiles,
      depth,
      maxDepth: program.maxDepth,
      blocked: () =>
        ctx.choice.current() != null || ctx.match.lifecycle() === 'finished',
      onLand: ({ tile }) => {
        if (!tile) return;
        ctx.events.message('game.pawn.landed', { playerId, tileId: tile.n });
        if (tile.type === 'move' && tile.delta)
          move(playerId, tile.delta, depth + 1, ctx);
        else if (tile.type === 'skip')
          ctx.turn.skip(playerId, tile.turnsToSkip ?? 1);
        else if (tile.type === 'question' || tile.type === 'challenge')
          drawChoice(playerId, tile.type, ctx);
        else if (tile.type === 'event') drawEventCard(playerId, ctx);
        else if (tile.type === 'swapNearest') swapNearest(playerId, ctx);
        else if (tile.type === 'goto' && tile.target != null) {
          ctx.movement.moveTo(program.trackId, playerId, tile.target - 1);
          resolveTile(move, playerId, depth + 1, ctx);
        } else if (tile.type === 'finish')
          ctx.match.finish({
            winners: [playerId],
            reason: program.finishReason,
          });
        if (tile.keepTurn && ctx.match.lifecycle() !== 'finished')
          ctx.turn.extra();
      },
    });
  }

  function drawChoice(
    playerId: number,
    kind: 'question' | 'challenge',
    ctx: Context,
  ): void {
    const deckId =
      kind === 'question' ? program.questionDeckId : program.challengeDeckId;
    const card = drawEvent<State, QuizEventChoiceCard>(ctx, {
      deckId,
      playerId,
      recycle: true,
      discard: true,
    });
    if (!card) return;
    ctx.choice.one({
      id: program.answerChoiceId,
      player: playerId,
      options: card.choices.map((_choice, index) => index),
      data: {
        kind: 'answer',
        actorId: playerId,
        deck: kind === 'question' ? 'questions' : 'challenges',
        cardId: card.id,
      } satisfies Pending,
      label: (index) => card.choices[index],
    });
  }

  function drawEventCard(playerId: number, ctx: Context) {
    drawAndResolve<State, QuizEventEventCard>(ctx, {
      deckId: program.eventDeckId,
      playerId,
      recycle: true,
      discard: true,
      resolve: (card) => ctx.effects.schedule(...card.effects),
    });
  }

  function requestMove(
    actorId: number,
    cardId: number,
    deltas: readonly number[],
    ctx: Context,
  ) {
    const options = moveOptions(deltas, ctx);
    ctx.choice.one({
      id: program.eventMoveChoiceId,
      player: actorId,
      options: options.map(encode),
      data: { kind: 'event-move', actorId, cardId } satisfies Pending,
      label: (value) => {
        const option = options.find((candidate) => encode(candidate) === value);
        const name = option ? ctx.players.get(option.targetId)?.username : null;
        return option
          ? `${name ?? option.targetId} ${option.delta >= 0 ? '+' : ''}${option.delta}`
          : value;
      },
    });
  }

  function moveOptions(deltas: readonly number[], ctx: Context) {
    return deltas.flatMap((delta) =>
      ctx.players.all().map((player) => ({ targetId: player.id, delta })),
    );
  }

  function encode(value: { targetId: number; delta: number }) {
    return `${value.targetId}:${value.delta}`;
  }

  function swapNearest(playerId: number, ctx: Context) {
    const current = ctx.movement.position(program.trackId, playerId);
    const nearest = ctx.ranking.rank(ctx.players.otherIds(playerId), {
      value: (id) =>
        Math.abs(ctx.movement.position(program.trackId, id) - current),
      direction: 'asc',
    })[0];
    if (nearest) ctx.movement.swap(program.trackId, playerId, nearest.playerId);
  }
}
