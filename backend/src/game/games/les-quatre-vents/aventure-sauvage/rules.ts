import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import { AVENTURE_PAWNS, AVENTURE_TILES } from './content';
import type { AventureCard, AventureSauvageState } from './state';

type RuleContext = GameRuleContext<AventureSauvageState>;
const TRACK = 'jungle';
const MAX_EFFECT_DEPTH = 12;

export const roll = defineAction<AventureSauvageState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé et résout immédiatement la case de jungle.',
  available: ({ state }) => state.setupComplete,
  execute: ({ state, actor, ctx }) => {
    const value = ctx.dice.roll('main').total;
    state.lastRoll = value;
    const position = ctx.movement.move(TRACK, actor.id, value);
    ctx.history.add(`${actor.username} lance le dé : « ${value} ».`);
    resolveLanding(state, actor.id, position, 0, ctx);
    if (state.winnerId == null) ctx.turn.end();
  },
});

export const AVENTURE_ACTIONS = { roll };

export function resolvePawnChoice(
  state: AventureSauvageState,
  actorId: number,
  pawnId: string,
  ctx: RuleContext,
): void {
  if (!AVENTURE_PAWNS.some((pawn) => pawn.id === pawnId)) {
    throw new Error('Pion Aventure Sauvage invalide');
  }
  if (Object.values(state.pawnByPlayerId).includes(pawnId)) {
    throw new Error('Ce pion est déjà choisi');
  }
  state.pawnByPlayerId[actorId] = pawnId;
  const next = ctx.players
    .all()
    .find((player) => state.pawnByPlayerId[player.id] == null);
  if (next) {
    ctx.turn.to(next.id);
    requestPawn(state, next.id, ctx);
  } else {
    state.setupComplete = true;
    ctx.transitionTo('playing');
    const first = ctx.players.all()[0];
    if (first) ctx.turn.to(first.id);
  }
}

export function requestPawn(
  state: AventureSauvageState,
  playerId: number,
  ctx: RuleContext,
): void {
  const used = new Set(Object.values(state.pawnByPlayerId));
  const options = AVENTURE_PAWNS.filter((pawn) => !used.has(pawn.id));
  ctx.choice.one({
    id: 'aventure.pawn',
    player: playerId,
    options: options.map((pawn) => pawn.id),
    label: (pawnId) =>
      options.find((pawn) => pawn.id === pawnId)?.label ?? pawnId,
  });
}

export function skipAventurePlayer(
  state: AventureSauvageState,
  ctx: RuleContext,
): void {
  const current = ctx.players.current();
  if (!current) return;
  state.skipTurns[current.id] = Math.max(0, state.skipTurns[current.id] - 1);
  ctx.history.add(`${current.username} passe son tour.`);
  ctx.turn.end();
}

function resolveLanding(
  state: AventureSauvageState,
  playerId: number,
  position: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_EFFECT_DEPTH || state.winnerId != null) return;
  const tile = AVENTURE_TILES[position];
  if (!tile) return;
  ctx.history.add(
    `${ctx.players.get(playerId)?.username ?? 'Le joueur'} atteint « ${tile.label} ».`,
  );
  if (tile.type === 'finish') {
    state.winnerId = playerId;
    return;
  }
  if (tile.type === 'animal' || tile.type === 'patte') {
    const card = ctx.cards.drawOrRecycle<AventureCard>(tile.type);
    if (!card) return;
    ctx.cards.discard(tile.type, card);
    applyCard(state, playerId, card, depth + 1, ctx);
  }
}

function applyCard(
  state: AventureSauvageState,
  playerId: number,
  card: AventureCard,
  depth: number,
  ctx: RuleContext,
): void {
  ctx.history.add(card.text);
  if (card.moveDelta) {
    const position = ctx.movement.move(TRACK, playerId, card.moveDelta);
    resolveLanding(state, playerId, position, depth, ctx);
  }
  if (card.skipTurns) state.skipTurns[playerId] += card.skipTurns;
  if (card.reroll) ctx.turn.extra();
}
