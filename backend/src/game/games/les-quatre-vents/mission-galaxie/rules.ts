import {
  defineEffect,
  drawAndResolve,
  gameInput,
  rejectRule,
  raceTurn,
} from '../../../engine/sdk/public-api';
import type { GameContext } from '../../../engine/sdk/public-api';
import { MISSION_GALAXIE_CONTENT } from './content';
import type {
  MissionGalaxieChoiceCard,
  MissionGalaxieEventCard,
  MissionGalaxieState,
} from './state';

type RuleContext = GameContext<MissionGalaxieState>;
const TRACK = 'galaxy';
const MAX_EFFECT_DEPTH = 20;

export const roll = raceTurn<MissionGalaxieState>({
  trackId: TRACK,
  documentation: 'Lance le dé et résout entièrement la case galactique.',
  resolveLanding: ({ state, playerId, ctx }) => {
    resolveMissionTile(state, playerId, 0, ctx);
  },
});

export const MISSION_GALAXIE_ACTIONS = { roll };

export function resolveMissionAnswer(
  state: MissionGalaxieState,
  value: number,
  ctx: RuleContext,
): void {
  const pending =
    ctx.choice.consumeContinuation<import('./state').MissionGalaxiePending>();
  if (!pending || pending.kind !== 'answer') {
    rejectRule('Réponse Mission Galaxie introuvable');
  }
  const card = MISSION_GALAXIE_CONTENT[pending.deck].find(
    (candidate) => candidate.id === pending.cardId,
  );
  if (!card) rejectRule('Carte Mission Galaxie inconnue');
  const delta =
    value === card.correctIndex ? card.correctDelta : card.wrongDelta;
  moveMissionAndResolve(state, pending.actorId, delta, 0, ctx);
  ctx.turn.complete({ waiting: ctx.choice.current() != null });
}

export function resolveMissionEventMove(
  state: MissionGalaxieState,
  value: string,
  ctx: RuleContext,
): void {
  const pending =
    ctx.choice.consumeContinuation<import('./state').MissionGalaxiePending>();
  if (!pending || pending.kind !== 'event-move') {
    rejectRule('Événement Mission Galaxie introuvable');
  }
  const card = MISSION_GALAXIE_CONTENT.events.find(
    (candidate) => candidate.id === pending.cardId,
  );
  if (!card?.moveDeltas) {
    rejectRule('Événement galactique inconnu');
  }
  const option = eventMoveOptions(card.moveDeltas, ctx).find(
    (candidate) => encodeMove(candidate) === value,
  );
  if (!option) rejectRule('Mouvement galactique invalide');
  moveMissionAndResolve(state, option.targetId, option.delta, 0, ctx);
  ctx.turn.complete({ waiting: ctx.choice.current() != null });
}

function resolveMissionTile(
  state: MissionGalaxieState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  ctx.movement.resolveLanding({
    trackId: TRACK,
    playerId,
    tiles: MISSION_GALAXIE_CONTENT.tiles,
    depth,
    maxDepth: MAX_EFFECT_DEPTH,
    blocked: () =>
      ctx.choice.current() != null || ctx.match.lifecycle() === 'finished',
    onLand: ({ tile }) => {
      if (!tile) return;
      ctx.events.message('game.pawn.landed', { playerId, tileId: tile.n });
      if (tile.type === 'move' && tile.delta) {
        moveMissionAndResolve(state, playerId, tile.delta, depth + 1, ctx);
      } else if (tile.type === 'skip') {
        ctx.turn.skip(playerId, tile.turnsToSkip ?? 1);
      } else if (tile.type === 'question' || tile.type === 'challenge') {
        drawChoiceCard(
          state,
          playerId,
          tile.type === 'question' ? 'questions' : 'challenges',
          ctx,
        );
      } else if (tile.type === 'event') {
        resolveMissionEvent(playerId, ctx);
      } else if (tile.type === 'swapNearest') {
        swapNearest(playerId, ctx);
      } else if (tile.type === 'goto' && tile.target != null) {
        setPosition(playerId, tile.target - 1, ctx);
        resolveMissionTile(state, playerId, depth + 1, ctx);
      } else if (tile.type === 'finish') {
        ctx.match.finish({ winners: [playerId], reason: 'legendary-planet' });
      }
      if (tile.keepTurn && ctx.match.lifecycle() !== 'finished') {
        ctx.turn.extra();
      }
    },
  });
}

function drawChoiceCard(
  _state: MissionGalaxieState,
  playerId: number,
  deck: 'questions' | 'challenges',
  ctx: RuleContext,
): void {
  const card = ctx.cards.drawOrRecycle<MissionGalaxieChoiceCard>(deck);
  if (!card) return;
  ctx.cards.discard(deck, card);
  const pending = {
    kind: 'answer' as const,
    actorId: playerId,
    deck,
    cardId: card.id,
  };
  ctx.choice.one({
    id: 'mission-galaxie.answer',
    player: playerId,
    options: card.choices.map((_choice, index) => index),
    data: pending,
    label: (index) => card.choices[index],
  });
}

function resolveMissionEvent(playerId: number, ctx: RuleContext): void {
  drawAndResolve<MissionGalaxieState, MissionGalaxieEventCard>(ctx, {
    deckId: 'events',
    playerId,
    recycle: true,
    discard: true,
    resolve: (card) => ctx.effects.schedule(...card.effects),
  });
}

export function requestEventMove(
  actorId: number,
  cardId: number,
  deltas: number[],
  ctx: RuleContext,
): void {
  const options = eventMoveOptions(deltas, ctx);
  const pending = { kind: 'event-move' as const, actorId, cardId };
  ctx.choice.one({
    id: 'mission-galaxie.event-move',
    player: actorId,
    options: options.map(encodeMove),
    data: pending,
    label: (value) => {
      const option = options.find(
        (candidate) => encodeMove(candidate) === value,
      );
      const name = option ? ctx.players.get(option.targetId)?.username : null;
      return option
        ? `${name ?? option.targetId} ${option.delta >= 0 ? '+' : ''}${option.delta}`
        : value;
    },
  });
}

function eventMoveOptions(
  deltas: readonly number[],
  ctx: RuleContext,
): Array<{ targetId: number; delta: number }> {
  return deltas.flatMap((delta) =>
    ctx.players.all().map((player) => ({ targetId: player.id, delta })),
  );
}

export function moveMissionAndResolve(
  state: MissionGalaxieState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  ctx.movement.moveAndResolve({
    trackId: TRACK,
    playerId,
    distance: delta,
    depth: depth + 1,
    maxDepth: MAX_EFFECT_DEPTH,
    blocked: () =>
      ctx.choice.current() != null || ctx.match.lifecycle() === 'finished',
    onLand: () => resolveMissionTile(state, playerId, depth + 1, ctx),
  });
}

function swapNearest(playerId: number, ctx: RuleContext): void {
  const current = ctx.movement.position(TRACK, playerId);
  const nearest = ctx.players
    .all()
    .filter((player) => player.id !== playerId)
    .map((player) => ({
      id: player.id,
      position: ctx.movement.position(TRACK, player.id),
    }))
    .sort(
      (a, b) =>
        Math.abs(a.position - current) - Math.abs(b.position - current) ||
        a.id - b.id,
    )[0];
  if (!nearest) return;
  ctx.movement.swap(TRACK, playerId, nearest.id);
}

function setPosition(playerId: number, next: number, ctx: RuleContext): void {
  const current = ctx.movement.position(TRACK, playerId);
  ctx.movement.move(TRACK, playerId, next - current);
}

export const MISSION_GALAXIE_EFFECTS = {
  'mission-galaxie.move': defineEffect<MissionGalaxieState, { delta: number }>({
    input: gameInput.object({
      delta: gameInput.number({ integer: true }),
    }),
    apply: ({ state, actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        moveMissionAndResolve(state, actorPlayerId, data.delta, 0, ctx);
      }
    },
  }),
  'mission-galaxie.goto': defineEffect<MissionGalaxieState, { target: number }>(
    {
      input: gameInput.object({
        target: gameInput.number({ integer: true, min: 1 }),
      }),
      apply: ({ state, actorPlayerId, data, ctx }) => {
        if (actorPlayerId == null) return;
        const position = data.target - 1;
        setPosition(actorPlayerId, position, ctx);
        resolveMissionTile(state, actorPlayerId, 0, ctx);
      },
    },
  ),
  'mission-galaxie.choose-player-move': defineEffect<
    MissionGalaxieState,
    { cardId: number; deltas: number[] }
  >({
    input: gameInput.object({
      cardId: gameInput.number({ integer: true, min: 1 }),
      deltas: gameInput.array(gameInput.number({ integer: true }), { min: 1 }),
    }),
    apply: ({ actorPlayerId, data, ctx }) => {
      if (actorPlayerId != null) {
        requestEventMove(actorPlayerId, data.cardId, data.deltas, ctx);
      }
    },
  }),
} as const;

function encodeMove(option: { targetId: number; delta: number }): string {
  return `${option.targetId}:${option.delta}`;
}
