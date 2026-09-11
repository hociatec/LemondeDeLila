import type { GameContext } from '../../../engine/sdk/public-api';
import {
  drawAndResolve,
  gameEffects,
  raceTurn,
  rejectRule,
} from '../../../engine/sdk/public-api';
import { TRACK } from './constants';
import { VOYAGE_CONTENT } from './content';
import type {
  VoyageCard,
  VoyageCollection,
  VoyageCollectionKind,
  VoyagePendingChoice,
  VoyageState,
  VoyageTargetEffect,
  VoyageTileType,
} from './types';

type RuleContext = GameContext<VoyageState>;
export { TRACK } from './constants';
export const COLLECTION_KINDS: VoyageCollectionKind[] = [
  'legend',
  'farce',
  'treasure',
  'landscape',
];
const VOYAGE_LAST_TARGET = 'voyage.last-target';
export const VOYAGE_FINISH_COUNTDOWN = 'voyage.finish-countdown';
export const VOYAGE_FINISH_STARTED = 'voyage.finish-started';

export const roll = raceTurn<VoyageState>({
  trackId: TRACK,
  documentation: 'Lance le dé, avance avec rebond et résout la case atteinte.',
  resolveLanding: ({ state, playerId, ctx }) => {
    resolveVoyageTile(state, playerId, false, ctx);
  },
});

export const VOYAGE_ACTIONS = { roll };

export function resolveVoyageQuiz(
  state: VoyageState,
  value: string,
  ctx: RuleContext,
): void {
  const pending = ctx.choice.consumeContinuation<VoyagePendingChoice>();
  if (!pending) rejectRule('Choix Voyage introuvable');
  resolveQuiz(state, pending, value, ctx);
  ctx.turn.complete({ waiting: ctx.choice.current() != null });
}

export function resolveVoyageTile(
  state: VoyageState,
  playerId: number,
  fromPassage: boolean,
  ctx: RuleContext,
): void {
  ctx.movement.resolveLanding({
    trackId: TRACK,
    playerId,
    tiles: VOYAGE_CONTENT.tiles,
    onLand: ({ position: current, tile }) => {
      if (!tile) return;
      ctx.events.message('game.pawn.landed', {
        playerId,
        tileId: current,
      });
      if (tile.type === 'finish') {
        if (ctx.counters.get(VOYAGE_FINISH_STARTED) === 0) {
          ctx.counters.set(VOYAGE_FINISH_STARTED, 1);
          ctx.counters.set(VOYAGE_FINISH_COUNTDOWN, ctx.players.all().length);
        }
      } else if (tile.type === 'rest') {
        ctx.turn.skip(playerId, 1);
      } else if (tile.type === 'passage' && !fromPassage) {
        if (tile.passageEffect?.kind === 'swap-position') {
          scheduleTargetEffect(playerId, 'swap-position', 1, ctx);
        } else if (tile.passageEffect?.kind === 'move') {
          ctx.movement.move(TRACK, playerId, tile.passageEffect.delta);
          resolveVoyageTile(state, playerId, true, ctx);
        }
      } else if (isDeckTile(tile.type)) {
        drawVoyageCard(playerId, tile.type, ctx);
      }
    },
  });
}

function drawVoyageCard(
  playerId: number,
  deck: VoyageCollectionKind,
  ctx: RuleContext,
): void {
  drawAndResolve<VoyageState, VoyageCard, boolean>(ctx, {
    deckId: deck,
    playerId,
    resolve: (card) => {
      if (card.quiz) {
        const quiz = card.quiz;
        const pending: VoyagePendingChoice = {
          kind: 'quiz',
          actorId: playerId,
          cardId: card.id,
        };
        ctx.choice.one({
          id: 'voyage.choice',
          player: playerId,
          options: quiz.choices.map((choice) => choice.id),
          label: (id) => {
            const choice = quiz.choices.find(
              (candidate) => candidate.id === id,
            );
            if (!choice) return ctx.reject('UNKNOWN_QUIZ_CHOICE', { id });
            return choice.label;
          },
          data: pending,
        });
        return false;
      }
      if (card.collectionGain) gain(playerId, card.collectionGain, ctx);
      ctx.effects.schedule(...card.effects);
      return card.discardAfterResolve;
    },
    discard: ({ result }) => result,
  });
}

function resolveQuiz(
  _state: VoyageState,
  pending: Extract<VoyagePendingChoice, { kind: 'quiz' }>,
  answer: string,
  ctx: RuleContext,
): void {
  const card = VOYAGE_CONTENT.legend.find(
    (candidate) => candidate.id === pending.cardId,
  );
  const quiz = card?.quiz ?? null;
  if (!card || !quiz) rejectRule('Question Voyage inconnue');
  if (answer !== quiz.answerId) {
    ctx.cards.discard('legend', card);
    ctx.events.message('game.quiz.answered', {
      playerId: pending.actorId,
      correct: false,
      cardId: card.id,
    });
    return;
  }
  ctx.events.message('game.quiz.answered', {
    playerId: pending.actorId,
    correct: true,
    cardId: card.id,
  });
  gain(pending.actorId, 'legend', ctx);
  if (quiz.successDelta !== 0) {
    ctx.movement.move(TRACK, pending.actorId, quiz.successDelta);
  }
}

export function applyVoyageTarget(
  actorId: number,
  targetId: number,
  effect: VoyageTargetEffect,
  count: number,
  ctx: RuleContext,
): void {
  if (effect === 'swap-position') {
    ctx.movement.swap(TRACK, actorId, targetId);
  } else if (effect === 'skip-turn') {
    ctx.turn.skip(targetId, 1);
  } else {
    exchangeRandomCards(actorId, targetId, count, ctx);
  }
  ctx.status.add(actorId, VOYAGE_LAST_TARGET, {
    scope: 'match',
    data: { targetPlayerId: targetId },
  });
}

export function scheduleTargetEffect(
  actorId: number,
  effect: VoyageTargetEffect,
  count: number,
  ctx: RuleContext,
): void {
  const options = targetOptions(actorId, ctx);
  if (options.length === 0) return;
  ctx.effects.schedule(
    gameEffects.custom(
      'voyage.target',
      { effect, count },
      gameEffects.target.chosenFrom(options, `voyage.${effect}`),
    ),
    gameEffects.completeTurn(),
  );
}

function targetOptions(actorId: number, ctx: RuleContext): number[] {
  const last = lastTarget(actorId, ctx);
  return ctx.players.otherIds(actorId).filter((id) => id !== last);
}

function exchangeRandomCards(
  firstId: number,
  secondId: number,
  count: number,
  ctx: RuleContext,
): void {
  for (let index = 0; index < count; index += 1) {
    const first = takeRandomKind(firstId, ctx);
    const second = takeRandomKind(secondId, ctx);
    if (first) ctx.resources.add(secondId, collectionResource(first), 1);
    if (second) ctx.resources.add(firstId, collectionResource(second), 1);
  }
}

export function loseRandomCard(
  playerId: number,
  allowed: VoyageCollectionKind[],
  ctx: RuleContext,
): void {
  const choices = allowed.filter(
    (kind) => ctx.resources.get(playerId, collectionResource(kind)) > 0,
  );
  const picked = ctx.random.pick(choices);
  if (picked) ctx.resources.remove(playerId, collectionResource(picked), 1);
}

function takeRandomKind(
  playerId: number,
  ctx: RuleContext,
): VoyageCollectionKind | null {
  const kind = ctx.random.pick(
    COLLECTION_KINDS.filter(
      (candidate) =>
        ctx.resources.get(playerId, collectionResource(candidate)) > 0,
    ),
  );
  if (kind) ctx.resources.remove(playerId, collectionResource(kind), 1);
  return kind;
}

export function advanceFinishCountdown(
  _state: VoyageState,
  ctx: RuleContext,
): void {
  if (ctx.counters.get(VOYAGE_FINISH_STARTED) === 0) return;
  const finishCountdown = Math.max(
    0,
    ctx.counters.get(VOYAGE_FINISH_COUNTDOWN) - 1,
  );
  ctx.counters.set(VOYAGE_FINISH_COUNTDOWN, finishCountdown);
  if (finishCountdown === 0) {
    const ranked = ctx.ranking.rank(
      ctx.players.all().map((player) => player.id),
      { value: (id) => total(voyageCollection(id, ctx)), direction: 'desc' },
      { value: (id) => voyageCollection(id, ctx).legend, direction: 'desc' },
    );
    const winnerId = ranked[0]?.playerId;
    if (winnerId != null) {
      ctx.match.finish({ winners: [winnerId], reason: 'irish-collection' });
    }
  }
}

function gain(
  playerId: number,
  kind: VoyageCollectionKind,
  ctx: RuleContext,
): void {
  ctx.resources.add(playerId, collectionResource(kind), 1);
}

function total(collection: VoyageCollection): number {
  return COLLECTION_KINDS.reduce((sum, kind) => sum + collection[kind], 0);
}

function voyageCollection(
  playerId: number,
  ctx: RuleContext,
): VoyageCollection {
  return {
    legend: ctx.resources.get(playerId, collectionResource('legend')),
    farce: ctx.resources.get(playerId, collectionResource('farce')),
    treasure: ctx.resources.get(playerId, collectionResource('treasure')),
    landscape: ctx.resources.get(playerId, collectionResource('landscape')),
  };
}

function collectionResource(kind: VoyageCollectionKind): string {
  return `voyage.collection.${kind}`;
}

function lastTarget(playerId: number, ctx: RuleContext): number | null {
  const value = ctx.status.get(playerId, VOYAGE_LAST_TARGET)?.data
    .targetPlayerId;
  return typeof value === 'number' ? value : null;
}

function isDeckTile(type: VoyageTileType): type is VoyageCollectionKind {
  return COLLECTION_KINDS.some((kind) => kind === type);
}
