import {
  defineChoice,
  gameInput,
  drawAndResolve,
  raceTurn,
} from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import type {
  ChapterEncounterCard,
  ChapterEncounterCollectionKind,
  ChapterEncounterProgram,
} from './program';
import {
  defineEffect,
  defineActorEffect,
} from '../../../engine/sdk/extension-api';

type State = Record<string, never>;
type Context = GameContext<State>;
type TargetEffect = 'swap-position' | 'skip-turn' | 'swap-card';
type PendingQuiz = {
  kind: 'quiz';
  actorId: number;
  cardId: number;
  deckId?: string;
};

export function chapterEncounterRules(source: ChapterEncounterProgram) {
  const program = structuredClone(source);
  return {
    roll: raceTurn<State>({
      trackId: program.trackId,
      diceId: program.diceId,
      documentation: 'Lance le dé, avance avec rebond et résout la case.',
      resolveLanding: ({ playerId, ctx }) => resolveTile(playerId, false, ctx),
    }),
    choices: {
      [program.choiceId]: defineChoice<State, string>({
        input: gameInput.string({ min: 1, max: 256 }),
        resolve: ({ value, ctx }) => resolveQuiz(value, ctx),
      }),
    },
    effects: effects(),
    lifecycle: {
      afterTurn: ({ ctx }: { ctx: Context }) => advanceCountdown(ctx),
    },
  };

  function resolveTile(playerId: number, fromPassage: boolean, ctx: Context) {
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
            scheduleTarget(playerId, 'swap-position', 1, ctx);
          else if (tile.passageEffect?.kind === 'move') {
            ctx.movement.move(
              program.trackId,
              playerId,
              tile.passageEffect.delta,
            );
            resolveTile(playerId, true, ctx);
          }
        } else if (isCollection(tile.type)) drawCard(playerId, tile.type, ctx);
      },
    });
  }

  function drawCard(
    playerId: number,
    deckId: ChapterEncounterCollectionKind,
    ctx: Context,
  ) {
    drawAndResolve<State, ChapterEncounterCard, boolean>(ctx, {
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
            data: { kind: 'quiz', actorId: playerId, cardId: card.id, deckId },
          });
          return false;
        }
        if (card.collectionGain)
          ctx.resources.add(playerId, resource(card.collectionGain), 1);
        ctx.effects.schedule(...card.effects);
        return card.discardAfterResolve;
      },
      discard: ({ result }) => result,
    });
  }

  function resolveQuiz(answer: string, ctx: Context) {
    const pending = ctx.choice.consumeContinuation<PendingQuiz>();
    if (!pending) return ctx.reject('CHAPTER_ENCOUNTER_CHOICE_NOT_FOUND');
    const deckId = pending.deckId ?? program.legacyQuizDeckId;
    const card = program.decks[deckId]?.find(
      (entry) => entry.id === pending.cardId,
    );
    const quiz = card?.quiz;
    if (!card || !quiz) return ctx.reject('CHAPTER_ENCOUNTER_QUIZ_NOT_FOUND');
    const correct = answer === quiz.answerId;
    ctx.events.message('game.quiz.answered', {
      playerId: pending.actorId,
      correct,
      cardId: card.id,
    });
    if (!correct) ctx.cards.discard(deckId, card);
    else {
      ctx.resources.add(
        pending.actorId,
        resource(card.collectionGain ?? deckId),
        1,
      );
      if (quiz.successDelta !== 0)
        ctx.movement.move(program.trackId, pending.actorId, quiz.successDelta);
    }
    ctx.turn.complete();
  }

  function effects() {
    const targetInput = gameInput.object({
      effect: gameInput.enum(['swap-position', 'skip-turn', 'swap-card']),
      count: gameInput.number({ integer: true, min: 1 }),
    });
    return {
      'choice-chapter-encounter.schedule-target': defineEffect<
        State,
        { effect: TargetEffect; count: number }
      >({
        input: targetInput,
        apply: ({ actorPlayerId, data, ctx }) => {
          if (actorPlayerId != null)
            scheduleTarget(actorPlayerId, data.effect, data.count, ctx);
        },
      }),
      'choice-chapter-encounter.lose-random-card': defineEffect<
        State,
        { allowed: ChapterEncounterCollectionKind[] }
      >({
        input: gameInput.object({
          allowed: gameInput.array(gameInput.enum(program.collectionKinds), {
            min: 1,
          }),
        }),
        apply: ({ actorPlayerId, data, ctx }) => {
          if (actorPlayerId != null)
            loseRandom(actorPlayerId, data.allowed, ctx);
        },
      }),
      'choice-chapter-encounter.swap-last-player': defineActorEffect<State>(
        ({ actorPlayerId, ctx }) => {
          const target = ctx.ranking.rank(ctx.players.otherIds(actorPlayerId), {
            value: (id) => ctx.movement.position(program.trackId, id),
            direction: 'asc',
          })[0]?.playerId;
          if (target != null)
            ctx.movement.swap(program.trackId, actorPlayerId, target);
        },
      ),
      'choice-chapter-encounter.target': defineEffect<
        State,
        { effect: TargetEffect; count: number }
      >({
        input: targetInput,
        apply: ({ actorPlayerId, targetPlayerIds, data, ctx }) => {
          const targetId = targetPlayerIds[0];
          if (actorPlayerId != null && targetId != null)
            applyTarget(actorPlayerId, targetId, data.effect, data.count, ctx);
        },
      }),
    };
  }

  function scheduleTarget(
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
        effectId: 'choice-chapter-encounter.target',
        data: { effect, count },
        target: {
          kind: 'chosen-player',
          playerIds: options,
          choiceId: `choice-chapter-encounter.${effect}`,
          optional: false,
        },
      },
      { kind: 'complete-turn' },
    );
  }

  function applyTarget(
    actorId: number,
    targetId: number,
    effect: TargetEffect,
    count: number,
    ctx: Context,
  ) {
    if (effect === 'swap-position')
      ctx.movement.swap(program.trackId, actorId, targetId);
    else if (effect === 'skip-turn') ctx.turn.skip(targetId, 1);
    else exchangeRandom(actorId, targetId, count, ctx);
    ctx.status.add(actorId, program.lastTargetStatusId, {
      scope: 'match',
      data: { targetPlayerId: targetId },
    });
  }

  function exchangeRandom(
    firstId: number,
    secondId: number,
    count: number,
    ctx: Context,
  ) {
    for (let index = 0; index < count; index += 1) {
      const first = randomKind(firstId, ctx);
      const second = randomKind(secondId, ctx);
      if (first && second)
        ctx.resources.exchange(
          firstId,
          secondId,
          { resource: resource(first), amount: 1 },
          { resource: resource(second), amount: 1 },
        );
      else if (first)
        ctx.resources.transfer(firstId, secondId, resource(first), 1);
      else if (second)
        ctx.resources.transfer(secondId, firstId, resource(second), 1);
    }
  }

  function loseRandom(
    playerId: number,
    allowed: readonly ChapterEncounterCollectionKind[],
    ctx: Context,
  ) {
    const picked = ctx.random.pick(
      allowed.filter((kind) => ctx.resources.get(playerId, resource(kind)) > 0),
    );
    if (picked) ctx.resources.remove(playerId, resource(picked), 1);
  }

  function randomKind(playerId: number, ctx: Context) {
    return ctx.random.pick(
      program.collectionKinds.filter(
        (kind) => ctx.resources.get(playerId, resource(kind)) > 0,
      ),
    );
  }

  function advanceCountdown(ctx: Context) {
    if (ctx.counters.get(program.finishStartedCounterId) === 0) return;
    const current = ctx.counters.get(program.finishCountdownCounterId);
    const remaining = Math.max(0, current - 1);
    ctx.counters.subtract(
      program.finishCountdownCounterId,
      current - remaining,
    );
    if (remaining !== 0) return;
    const ranking = ctx.ranking.rank(
      ctx.players.all().map((player) => player.id),
      {
        value: (playerId) =>
          program.collectionKinds.reduce(
            (sum, kind) => sum + ctx.resources.get(playerId, resource(kind)),
            0,
          ),
        direction: 'desc',
      },
      {
        value: (playerId) =>
          ctx.resources.get(playerId, resource(program.tieBreakCollection)),
        direction: 'desc',
      },
    );
    const winnerId = ranking[0]?.playerId;
    if (winnerId != null)
      ctx.match.finish({ winners: [winnerId], reason: program.finishReason });
  }

  function resource(kind: ChapterEncounterCollectionKind) {
    return `${program.collectionResourcePrefix}${kind}`;
  }

  function isCollection(
    value: string,
  ): value is ChapterEncounterCollectionKind {
    return program.collectionKinds.some((kind) => kind === value);
  }
}
