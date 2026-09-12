import { defineChoice } from '../../actions/action-builders';
import { gameInput } from '../../actions/game-input-schema';
import type {
  VoyageCard,
  VoyageCollectionKind,
  VoyageProgram,
} from './program';
import type { GameContext } from '../../definitions/game-author-context';
import { defineEffect } from '../../effects/effects-core';
import {
  drawAndResolve,
  raceTurn,
} from '../../recipes/gameplay/card-dice.recipes';

type State = Record<string, never>;
type Context = GameContext<State>;
type TargetEffect = 'swap-position' | 'skip-turn' | 'swap-card';
type PendingQuiz = { kind: 'quiz'; actorId: number; cardId: number };

export function voyageRules(source: VoyageProgram) {
  const program = structuredClone(source);
  return {
    roll: raceTurn<State>({
      trackId: program.trackId,
      diceId: program.diceId,
      documentation: 'Lance le dé, avance avec rebond et résout la case.',
      resolveLanding: ({ playerId, ctx }) =>
        resolveTile(program, playerId, false, ctx),
    }),
    choices: {
      [program.choiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 256 }),
        resolve: ({ value, ctx }) => resolveQuiz(program, value, ctx),
      }),
    },
    effects: effects(program),
    lifecycle: {
      afterTurn: ({ ctx }: { ctx: Context }) => advanceCountdown(program, ctx),
    },
  };
}
function resolveTile(
  program: VoyageProgram,
  playerId: number,
  fromPassage: boolean,
  ctx: Context,
) {
  ctx.movement.resolveLanding({
    trackId: program.trackId,
    playerId,
    tiles: program.tiles,
    onLand: ({ position, tile }) => {
      if (!tile) return;
      ctx.events.message('game.pawn.landed', { playerId, tileId: position });
      if (tile.type === 'finish') {
        if (ctx.counters.get(program.finishStartedCounterId) === 0) {
          ctx.counters.set(program.finishStartedCounterId, 1);
          ctx.counters.set(
            program.finishCountdownCounterId,
            ctx.players.all().length,
          );
        }
      } else if (tile.type === 'rest') ctx.turn.skip(playerId, 1);
      else if (tile.type === 'passage' && !fromPassage) {
        if (tile.passageEffect?.kind === 'swap-position')
          scheduleTarget(program, playerId, 'swap-position', 1, ctx);
        else if (tile.passageEffect?.kind === 'move') {
          ctx.movement.move(
            program.trackId,
            playerId,
            tile.passageEffect.delta,
          );
          resolveTile(program, playerId, true, ctx);
        }
      } else if (isCollection(program, tile.type))
        drawCard(program, playerId, tile.type, ctx);
    },
  });
}

function drawCard(
  program: VoyageProgram,
  playerId: number,
  deckId: VoyageCollectionKind,
  ctx: Context,
) {
  drawAndResolve<State, VoyageCard, boolean>(ctx, {
    deckId,
    playerId,
    resolve: (card) => {
      if (card.quiz) {
        const quiz = card.quiz;
        ctx.choice.one({
          id: program.choiceId,
          player: playerId,
          options: quiz.choices.map((choice) => choice.id),
          label: (id) => {
            const choice = quiz.choices.find(
              (candidate) => candidate.id === id,
            );
            if (!choice) return ctx.reject('UNKNOWN_QUIZ_CHOICE', { id });
            return choice.label;
          },
          data: { kind: 'quiz', actorId: playerId, cardId: card.id },
        });
        return false;
      }
      if (card.collectionGain)
        ctx.resources.add(playerId, resource(program, card.collectionGain), 1);
      ctx.effects.schedule(...card.effects);
      return card.discardAfterResolve;
    },
    discard: ({ result }) => result,
  });
}

function resolveQuiz(program: VoyageProgram, answer: string, ctx: Context) {
  const pending = ctx.choice.consumeContinuation<PendingQuiz>();
  if (!pending) return ctx.reject('VOYAGE_CHOICE_NOT_FOUND');
  const card = program.decks.legend.find(
    (entry) => entry.id === pending.cardId,
  );
  const quiz = card?.quiz;
  if (!card || !quiz) return ctx.reject('VOYAGE_QUIZ_NOT_FOUND');
  const correct = answer === quiz.answerId;
  ctx.events.message('game.quiz.answered', {
    playerId: pending.actorId,
    correct,
    cardId: card.id,
  });
  if (!correct) ctx.cards.discard('legend', card);
  else {
    ctx.resources.add(pending.actorId, resource(program, 'legend'), 1);
    if (quiz.successDelta !== 0)
      ctx.movement.move(program.trackId, pending.actorId, quiz.successDelta);
  }
  ctx.turn.complete();
}

function effects(program: VoyageProgram) {
  const targetInput = gameInput.object({
    effect: gameInput.enum(['swap-position', 'skip-turn', 'swap-card']),
    count: gameInput.number({ integer: true, min: 1 }),
  });
  return {
    'voyage.schedule-target': defineEffect<
      State,
      { effect: TargetEffect; count: number }
    >({
      input: targetInput,
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          scheduleTarget(program, actorPlayerId, data.effect, data.count, ctx);
      },
    }),
    'voyage.lose-random-card': defineEffect<
      State,
      { allowed: VoyageCollectionKind[] }
    >({
      input: gameInput.object({
        allowed: gameInput.array(
          gameInput.enum(['legend', 'farce', 'treasure', 'landscape']),
          { min: 1 },
        ),
      }),
      apply: ({ actorPlayerId, data, ctx }) => {
        if (actorPlayerId != null)
          loseRandom(program, actorPlayerId, data.allowed, ctx);
      },
    }),
    'voyage.swap-last-player': defineEffect<State, Record<string, never>>({
      input: gameInput.object({}),
      apply: ({ actorPlayerId, ctx }) => {
        if (actorPlayerId == null) return;
        const target = ctx.ranking.rank(ctx.players.otherIds(actorPlayerId), {
          value: (id) => ctx.movement.position(program.trackId, id),
          direction: 'asc',
        })[0]?.playerId;
        if (target != null)
          ctx.movement.swap(program.trackId, actorPlayerId, target);
      },
    }),
    'voyage.target': defineEffect<
      State,
      { effect: TargetEffect; count: number }
    >({
      input: targetInput,
      apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
        const targetId = targetPlayerIds[0];
        if (actorPlayerId != null && targetId != null)
          applyTarget(
            program,
            actorPlayerId,
            targetId,
            data.effect,
            data.count,
            ctx,
          );
      },
    }),
  };
}

function scheduleTarget(
  program: VoyageProgram,
  actorId: number,
  effect: TargetEffect,
  count: number,
  ctx: Context,
) {
  const previous = ctx.status.get(actorId, program.lastTargetStatusId)?.data
    .targetPlayerId;
  const options = ctx.players
    .otherIds(actorId)
    .filter((id) => id !== (typeof previous === 'number' ? previous : null));
  if (!options.length) return;
  ctx.effects.schedule(
    {
      kind: 'custom',
      effectId: 'voyage.target',
      data: { effect, count },
      target: {
        kind: 'chosen-player',
        playerIds: options,
        choiceId: `voyage.${effect}`,
        optional: false,
      },
    },
    { kind: 'complete-turn' },
  );
}

function applyTarget(
  program: VoyageProgram,
  actorId: number,
  targetId: number,
  effect: TargetEffect,
  count: number,
  ctx: Context,
) {
  if (effect === 'swap-position')
    ctx.movement.swap(program.trackId, actorId, targetId);
  else if (effect === 'skip-turn') ctx.turn.skip(targetId, 1);
  else exchangeRandom(program, actorId, targetId, count, ctx);
  ctx.status.add(actorId, program.lastTargetStatusId, {
    scope: 'match',
    data: { targetPlayerId: targetId },
  });
}

function exchangeRandom(
  program: VoyageProgram,
  firstId: number,
  secondId: number,
  count: number,
  ctx: Context,
) {
  for (let index = 0; index < count; index += 1) {
    const first = randomKind(program, firstId, ctx);
    const second = randomKind(program, secondId, ctx);
    if (first && second)
      ctx.resources.exchange(
        firstId,
        secondId,
        { resource: resource(program, first), amount: 1 },
        { resource: resource(program, second), amount: 1 },
      );
    else if (first)
      ctx.resources.transfer(firstId, secondId, resource(program, first), 1);
    else if (second)
      ctx.resources.transfer(secondId, firstId, resource(program, second), 1);
  }
}

function loseRandom(
  program: VoyageProgram,
  playerId: number,
  allowed: readonly VoyageCollectionKind[],
  ctx: Context,
) {
  const picked = ctx.random.pick(
    allowed.filter(
      (kind) => ctx.resources.get(playerId, resource(program, kind)) > 0,
    ),
  );
  if (picked) ctx.resources.remove(playerId, resource(program, picked), 1);
}

function randomKind(program: VoyageProgram, playerId: number, ctx: Context) {
  return ctx.random.pick(
    program.collectionKinds.filter(
      (kind) => ctx.resources.get(playerId, resource(program, kind)) > 0,
    ),
  );
}

function advanceCountdown(program: VoyageProgram, ctx: Context) {
  if (ctx.counters.get(program.finishStartedCounterId) === 0) return;
  const current = ctx.counters.get(program.finishCountdownCounterId);
  const remaining = Math.max(0, current - 1);
  ctx.counters.subtract(program.finishCountdownCounterId, current - remaining);
  if (remaining !== 0) return;
  const ranking = ctx.ranking.rank(
    ctx.players.all().map((player) => player.id),
    {
      value: (playerId) =>
        program.collectionKinds.reduce(
          (sum, kind) =>
            sum + ctx.resources.get(playerId, resource(program, kind)),
          0,
        ),
      direction: 'desc',
    },
    {
      value: (playerId) =>
        ctx.resources.get(playerId, resource(program, 'legend')),
      direction: 'desc',
    },
  );
  const winnerId = ranking[0]?.playerId;
  if (winnerId != null)
    ctx.match.finish({ winners: [winnerId], reason: 'irish-collection' });
}

function resource(program: VoyageProgram, kind: VoyageCollectionKind) {
  return `${program.collectionResourcePrefix}${kind}`;
}

function isCollection(
  program: VoyageProgram,
  value: string,
): value is VoyageCollectionKind {
  return program.collectionKinds.some((kind) => kind === value);
}
