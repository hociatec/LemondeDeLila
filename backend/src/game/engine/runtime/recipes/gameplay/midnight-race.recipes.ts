import type { MidnightRaceProgram } from '../../extensions/midnight-race/program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineAction, defineChoice } from '../../actions/action-builders';
import { defineEffect } from '../../effects/effects-core';
import { gameInput } from '../../actions/game-input-schema';
import { drawAndResolve } from './card-dice.recipes';
import { sequentialPawnSelection } from './pawn-selection.recipes';
import { GameRuleViolationError } from '../../../../core/domain/errors/game-domain.errors';

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = MidnightRaceProgram['cards'][number];
type Pending = { kind: 'quiz'; actorId: number; cardId: number };

export function midnightRaceRules(source: MidnightRaceProgram) {
  const program = structuredClone(source);
  const pawns = sequentialPawnSelection<State>({
    setId: program.pawnSetId,
    choiceId: program.pawnChoiceId,
    complete: ({ ctx }) => {
      ctx.phase.transitionTo('playing');
      const starter = ctx.round.starter();
      if (starter != null) ctx.turn.to(starter);
    },
  });
  return {
    roll: defineAction<State, Record<string, never>>({
      input: gameInput.object({}),
      available: ({ ctx }) => ctx.phase.current() === 'playing',
      execute: ({ actor, ctx }) => {
        if (ctx.status.consume(actor.id, program.statuses.forceDrawNextTurn))
          drawCard(program, actor.id, 0, ctx);
        else {
          const value = ctx.dice.roll(program.diceId).total;
          ctx.events.message('game.dice.rolled', {
            playerId: actor.id,
            diceId: program.diceId,
            total: value,
          });
          moveAndResolve(program, actor.id, value, 0, ctx);
        }
        ctx.turn.complete();
      },
      documentation:
        'Lance le dé ou applique la pioche forcée, puis résout la case.',
    }),
    setup: pawns.setup(() => ({})),
    choices: {
      [program.pawnChoiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 128 }),
        resolve: ({ actor, value, ctx }) => pawns.resolve(actor.id, value, ctx),
      }),
      [program.answerChoiceId]: defineChoice<State, number>({
        input: gameInput.number({ integer: true }),
        resolve: ({ value, ctx }) => resolveAnswer(program, value, ctx),
      }),
    },
    effects: effects(program),
  };
}
function resolveAnswer(
  program: MidnightRaceProgram,
  value: number,
  ctx: Context,
) {
  const pending = ctx.choice.consumeContinuation<Pending>();
  if (!pending || pending.kind !== 'quiz')
    throw new GameRuleViolationError('MINUIT_CHOICE_MISSING');
  const quiz = program.cards.find((card) => card.id === pending.cardId)?.quiz;
  if (!quiz || value < 0 || value >= quiz.choices.length)
    throw new GameRuleViolationError('MINUIT_ANSWER_INVALID');
  moveAndResolve(
    program,
    pending.actorId,
    quiz.anyCorrect || value === quiz.correctIndex
      ? quiz.successDelta
      : quiz.failureDelta,
    0,
    ctx,
  );
  ctx.turn.complete();
}

function moveAndResolve(
  program: MidnightRaceProgram,
  playerId: number,
  delta: number,
  depth: number,
  ctx: Context,
) {
  ctx.movement.moveAndResolve({
    trackId: program.trackId,
    playerId,
    distance: delta,
    tiles: program.tiles,
    depth: depth + 1,
    maxDepth: program.maxDepth,
    blocked: () =>
      ctx.choice.current() != null || ctx.match.lifecycle() === 'finished',
    onLand: () => applyTile(program, playerId, depth + 1, ctx),
  });
}

function resolveDestination(
  program: MidnightRaceProgram,
  playerId: number,
  depth: number,
  ctx: Context,
) {
  ctx.movement.resolveLanding({
    trackId: program.trackId,
    playerId,
    tiles: program.tiles,
    depth,
    maxDepth: program.maxDepth,
    blocked: () =>
      ctx.choice.current() != null || ctx.match.lifecycle() === 'finished',
    onLand: () => applyTile(program, playerId, depth, ctx),
  });
}

function applyTile(
  program: MidnightRaceProgram,
  playerId: number,
  depth: number,
  ctx: Context,
) {
  let current = ctx.movement.position(program.trackId, playerId);
  if (
    ctx.players
      .all()
      .some(
        (player) =>
          player.id !== playerId &&
          ctx.movement.position(program.trackId, player.id) === current,
      )
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
      moveAndResolve(program, playerId, tile.delta, depth, ctx);
  } else if (tile.type === 'skip') {
    if (ctx.status.consume(playerId, program.statuses.ignoreNextSkip)) return;
    ctx.turn.skip(playerId, tile.skipTurns);
  } else if (tile.type === 'card') drawCard(program, playerId, depth, ctx);
}

function drawCard(
  program: MidnightRaceProgram,
  playerId: number,
  depth: number,
  ctx: Context,
) {
  if (depth > program.maxDepth || ctx.choice.current()) return;
  drawAndResolve<State, Card>(ctx, {
    deckId: program.deckId,
    playerId,
    resolve: (card) => {
      if (!card.quiz) return ctx.effects.schedule(...card.effects);
      ctx.choice.one({
        id: program.answerChoiceId,
        player: playerId,
        options: card.quiz.choices.map((_choice, index) => index),
        data: {
          kind: 'quiz',
          actorId: playerId,
          cardId: card.id,
        } satisfies Pending,
        label: (index) => card.quiz?.choices[index] ?? String(index),
      });
    },
  });
}

function effects(program: MidnightRaceProgram) {
  return {
    'minuit.move': defineEffect<State, { delta: number }>({
      input: gameInput.object({ delta: gameInput.number({ integer: true }) }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId == null) return;
        if (
          data.delta < 0 &&
          ctx.status.consume(actorPlayerId, program.statuses.ignoreNextMalus)
        )
          return;
        moveAndResolve(program, actorPlayerId, data.delta, 0, ctx);
      },
    }),
    'minuit.roll': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId != null)
          moveAndResolve(
            program,
            actorPlayerId,
            ctx.dice.roll(program.diceId).total,
            0,
            ctx,
          );
      },
    }),
    'minuit.move-to-type': defineEffect<
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
            (data.direction === 'forward' ? index > current : index < current),
        );
        const selected =
          data.direction === 'forward' ? candidates[0] : candidates.at(-1);
        if (!selected) return;
        ctx.movement.moveTo(program.trackId, actorPlayerId, selected.n - 1);
        resolveDestination(program, actorPlayerId, 1, ctx);
      },
    }),
    'minuit.gift': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (actorPlayerId == null || targetId == null) return;
        ctx.movement.move(program.trackId, targetId, 1);
        moveAndResolve(program, actorPlayerId, 2, 0, ctx);
      },
    }),
    'minuit.swap': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, targetPlayerIds, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (actorPlayerId != null && targetId != null)
          ctx.movement.swap(program.trackId, actorPlayerId, targetId);
      },
    }),
    'minuit.swap-behind': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId == null) return;
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
    }),
  };
}
