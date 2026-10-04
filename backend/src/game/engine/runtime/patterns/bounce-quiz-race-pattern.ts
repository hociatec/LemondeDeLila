import { defineChoice, defineEmptyAction } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import { GameRuleViolationError } from '../contracts/game-domain.errors';
import type { GameContext } from '../definitions/game-author-context';
import {
  defineActorEffect,
  defineEffect,
  defineEmptyEffect,
  drawAndResolve,
  sequentialPawnSelection,
} from './pattern-capabilities';
import { definePattern } from './gameplay-pattern-core';
type State = Record<string, never>;
type Context = GameContext<State>;
type Card = BounceQuizRaceOptions['cards'][number];
type Pending = { kind: 'quiz'; actorId: number; cardId: number };
type PendingDraw = { playerId: number; depth: number };
export type BounceQuizRaceOptions = {
  rollRecipe: string;
  drawRecipe: string;
  pendingDrawFlag: string;
  trackId: string;
  diceId: string;
  deckId: string;
  pawnSetId: string;
  pawnChoiceId: string;
  answerChoiceId: string;
  maxDepth: number;
  finishReason: string;
  statuses: {
    ignoreNextMalus: string;
    ignoreNextSkip: string;
    forceDrawNextTurn: string;
  };
  tiles: readonly {
    n: number;
    title: string;
    description?: string;
    type: 'start' | 'neutral' | 'card' | 'move' | 'skip' | 'finish';
    delta: number;
    skipTurns: number;
  }[];
  cards: readonly {
    id: number;
    title: string;
    description?: string;
    effects: readonly GameEffectInstruction[];
    quiz?: {
      prompt: string;
      choices: readonly string[];
      correctIndex: number;
      successDelta: number;
      failureDelta: number;
      anyCorrect?: boolean;
    };
  }[];
};
export function bounceQuizRace(source: BounceQuizRaceOptions) {
  const program = structuredClone(source);
  const pawns = sequentialPawnSelection<State>({
    setId: program.pawnSetId,
    choiceId: program.pawnChoiceId,
    completePhase: 'playing',
  });
  const moveAndResolve = (
    playerId: number,
    delta: number,
    depth: number,
    ctx: Context,
  ): void => {
    ctx.movement.moveAndResolve({
      trackId: program.trackId,
      playerId,
      distance: delta,
      tiles: program.tiles,
      depth: depth + 1,
      maxDepth: program.maxDepth,
      blocked: () =>
        ctx.choice.current() != null || ctx.match.lifecycle() === 'finished',
      onLand: () => applyTile(playerId, depth + 1, ctx),
    });
  };
  const resolveDestination = (
    playerId: number,
    depth: number,
    ctx: Context,
  ): void => {
    ctx.movement.resolveLanding({
      trackId: program.trackId,
      playerId,
      tiles: program.tiles,
      depth,
      maxDepth: program.maxDepth,
      blocked: () =>
        ctx.choice.current() != null || ctx.match.lifecycle() === 'finished',
      onLand: () => applyTile(playerId, depth, ctx),
    });
  };
  const pendingDraws = (ctx: Context): PendingDraw[] => {
    const value = ctx.turn.flags.get(program.pendingDrawFlag);
    if (!Array.isArray(value)) return [];
    const draws: unknown[] = value;
    return draws.filter(
      (draw): draw is PendingDraw =>
        draw != null &&
        typeof draw === 'object' &&
        'playerId' in draw &&
        typeof draw.playerId === 'number' &&
        'depth' in draw &&
        typeof draw.depth === 'number',
    );
  };
  const awaitDraw = (playerId: number, depth: number, ctx: Context): void => {
    ctx.turn.flags.set(program.pendingDrawFlag, [
      ...pendingDraws(ctx),
      { playerId, depth },
    ]);
    ctx.events.message('game.card.draw-required', { playerId });
  };
  const drawCard = (playerId: number, depth: number, ctx: Context): void => {
    if (depth > program.maxDepth || ctx.choice.current()) return;
    drawAndResolve<State, Card>(ctx, {
      deckId: program.deckId,
      playerId,
      automatic: false,
      eventData: () => ({ effectDescription: '' }),
      resolve: (card) => {
        if (!card.quiz) return ctx.effects.schedule(...card.effects);
        ctx.choice.one({
          id: program.answerChoiceId,
          player: playerId,
          options: card.quiz.choices.map((_choice, index) => index),
          question: card.quiz.prompt,
          data: {
            kind: 'quiz',
            actorId: playerId,
            cardId: card.id,
          } satisfies Pending,
          label: (index) => card.quiz?.choices[index] ?? String(index),
        });
      },
    });
  };
  const applyTile = (playerId: number, depth: number, ctx: Context): void => {
    let current = ctx.movement.position(program.trackId, playerId);
    if (
      ctx.players
        .otherIds(playerId)
        .some((id) => ctx.movement.position(program.trackId, id) === current)
    ) {
      ctx.movement.moveTo(program.trackId, playerId, Math.max(0, current - 1));
      current = ctx.movement.position(program.trackId, playerId);
    }
    const tile = program.tiles[current];
    ctx.events.message('game.pawn.landed', { playerId, tileId: current });
    if (tile.type === 'finish')
      ctx.match.finish({ winners: [playerId], reason: program.finishReason });
    else if (tile.type === 'move') {
      if (!(
        tile.delta < 0 &&
        ctx.status.consume(playerId, program.statuses.ignoreNextMalus)
      ))
        moveAndResolve(playerId, tile.delta, depth, ctx);
    } else if (tile.type === 'skip') {
      if (!ctx.status.consume(playerId, program.statuses.ignoreNextSkip))
        ctx.turn.skip(playerId, tile.skipTurns);
    } else if (tile.type === 'card') awaitDraw(playerId, depth, ctx);
  };
  const resolveAnswer = (value: number, ctx: Context): void => {
    const pending = ctx.choice.consumeContinuation<Pending>();
    if (!pending || pending.kind !== 'quiz')
      throw new GameRuleViolationError('RACE_BOUNCE_QUIZ_CHOICE_MISSING');
    const quiz = program.cards.find((card) => card.id === pending.cardId)?.quiz;
    if (!quiz || value < 0 || value >= quiz.choices.length)
      throw new GameRuleViolationError('RACE_BOUNCE_QUIZ_ANSWER_INVALID');
    const correct = Boolean(quiz.anyCorrect || value === quiz.correctIndex);
    ctx.events.message('game.quiz.answered', {
      playerId: pending.actorId,
      correct,
    });
    moveAndResolve(
      pending.actorId,
      correct ? quiz.successDelta : quiz.failureDelta,
      0,
      ctx,
    );
    ctx.turn.complete({ waiting: pendingDraws(ctx).length > 0 });
  };
  return definePattern({
    id: `bounce-quiz-race:${program.trackId}`,
    mechanics: ['race', 'quiz', 'cards', 'pawns', 'effects'],
    actions: {
      [program.rollRecipe]: defineEmptyAction<State>({
        available: ({ ctx }) =>
          ctx.phase.current() === 'playing' && pendingDraws(ctx).length === 0,
        execute: ({ actor, ctx }) => {
          if (ctx.status.consume(actor.id, program.statuses.forceDrawNextTurn))
            awaitDraw(actor.id, 0, ctx);
          else {
            const value = ctx.dice.roll(program.diceId).total;
            ctx.events.message('game.dice.rolled', {
              playerId: actor.id,
              diceId: program.diceId,
              total: value,
            });
            moveAndResolve(actor.id, value, 0, ctx);
          }
          ctx.turn.complete({ waiting: pendingDraws(ctx).length > 0 });
        },
        documentation: 'Lance le dé ou applique la pioche forcée.',
      }),
      [program.drawRecipe]: defineEmptyAction<State>({
        ui: { label: 'Piocher', control: 'button', shortcut: 'Space' },
        available: ({ actor, ctx }) =>
          ctx.phase.current() === 'playing' &&
          ctx.players.current()?.id === actor.id &&
          pendingDraws(ctx)[0]?.playerId === actor.id,
        execute: ({ ctx }) => {
          const [pending, ...remaining] = pendingDraws(ctx);
          if (!pending) return ctx.reject('RACE_BOUNCE_QUIZ_DRAW_NOT_PENDING');
          if (remaining.length > 0)
            ctx.turn.flags.set(program.pendingDrawFlag, remaining);
          else ctx.turn.flags.consume(program.pendingDrawFlag);
          drawCard(pending.playerId, pending.depth, ctx);
          ctx.turn.complete({
            waiting:
              ctx.choice.current() != null || pendingDraws(ctx).length > 0,
          });
        },
        documentation: 'Pioche et résout la carte demandée par la case.',
      }),
    },
    setup: pawns.setup(() => ({})),
    choices: {
      [program.pawnChoiceId]: pawns.choice,
      [program.answerChoiceId]: defineChoice<State, number>({
        input: gameInput.number({ integer: true }),
        resolve: ({ value, ctx }) => resolveAnswer(value, ctx),
      }),
    },
    bot: {
      choose: ({ availableActions }) => {
        const type = [program.drawRecipe, program.rollRecipe].find((recipe) =>
          availableActions.includes(recipe),
        );
        return type ? { type, payload: {} } : null;
      },
    },
    effects: {
      'race-bounce-quiz.move': defineEffect<State, { delta: number }>({
        input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
        apply: ({ actorPlayerId, data, ctx }) => {
          if (
            actorPlayerId != null &&
            !(
              data.delta < 0 &&
              ctx.status.consume(
                actorPlayerId,
                program.statuses.ignoreNextMalus,
              )
            )
          )
            moveAndResolve(actorPlayerId, data.delta, 0, ctx);
        },
      }),
      'race-bounce-quiz.roll': defineActorEffect<State>(
        ({ actorPlayerId, ctx }) =>
          moveAndResolve(
            actorPlayerId,
            ctx.dice.roll(program.diceId).total,
            0,
            ctx,
          ),
      ),
      'race-bounce-quiz.move-to-type': defineEffect<
        State,
        { type: 'card' | 'neutral'; direction: 'forward' | 'backward' }
      >({
        input: gameInput.object({
          type: gameInput.enum(['card', 'neutral'] as const),
          direction: gameInput.enum(['forward', 'backward'] as const),
        }),
        apply: ({ actorPlayerId, data, ctx }) => {
          if (actorPlayerId == null) return;
          const current = ctx.movement.position(program.trackId, actorPlayerId);
          const candidates = program.tiles.filter(
            (tile, index) =>
              tile.type === data.type &&
              (data.direction === 'forward'
                ? index > current
                : index < current),
          );
          const selected =
            data.direction === 'forward' ? candidates[0] : candidates.at(-1);
          if (selected) {
            ctx.movement.moveTo(program.trackId, actorPlayerId, selected.n - 1);
            resolveDestination(actorPlayerId, 1, ctx);
          }
        },
      }),
      'race-bounce-quiz.gift': defineEmptyEffect<State>(
        ({ actorPlayerId, targetPlayerIds, ctx }) => {
          const id = targetPlayerIds[0];
          if (actorPlayerId != null && id != null) {
            ctx.movement.move(program.trackId, id, 1);
            moveAndResolve(actorPlayerId, 2, 0, ctx);
          }
        },
      ),
      'race-bounce-quiz.swap': defineEmptyEffect<State>(
        ({ actorPlayerId, targetPlayerIds, ctx }) => {
          const id = targetPlayerIds[0];
          if (actorPlayerId != null && id != null)
            ctx.movement.swap(program.trackId, actorPlayerId, id);
        },
      ),
      'race-bounce-quiz.swap-behind': defineActorEffect<State>(
        ({ actorPlayerId, ctx }) => {
          const current = ctx.movement.position(program.trackId, actorPlayerId);
          const behind = ctx.ranking.rank(
            ctx.players
              .otherIds(actorPlayerId)
              .filter(
                (id) => ctx.movement.position(program.trackId, id) < current,
              ),
            {
              value: (id) => ctx.movement.position(program.trackId, id),
              direction: 'desc',
            },
          )[0];
          if (behind)
            ctx.movement.swap(program.trackId, actorPlayerId, behind.playerId);
        },
      ),
    },
  });
}
