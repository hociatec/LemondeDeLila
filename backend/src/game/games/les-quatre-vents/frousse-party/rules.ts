import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  FROUSSE_PAWNS,
  FROUSSE_TILES,
  type FrousseBlock,
  type FrousseCard,
  type FrousseCardEffect,
  type FrousseCategory,
} from './content';
import type { FrousseState } from './state';

type RuleContext = GameRuleContext<FrousseState>;
const TRACK = 'manor';
const DECK = 'frights';
const FINISH = FROUSSE_TILES.length - 1;
const MAX_CHAIN_DEPTH = 24;

export const roll = defineAction<FrousseState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé, applique les altérations puis résout la case.',
  available: ({ state }) => state.setupComplete && state.pendingSwap == null,
  execute: ({ state, actor, ctx }) => {
    const blocked = state.blocked[actor.id];
    if (blocked) {
      const value = ctx.dice.roll('main').total;
      ctx.history.add(`${actor.username} tente de se libérer : ${value}.`);
      if (passesBlock(value, blocked)) {
        state.blocked[actor.id] = null;
        ctx.history.add(`${actor.username} se libère.`);
      }
      ctx.turn.end();
      return;
    }

    const value = modifiedRoll(state, actor.id, ctx);
    ctx.history.add(`${actor.username} lance le dé : ${value}.`);
    if (state.nextRollIfThreeBackTwo[actor.id]) {
      state.nextRollIfThreeBackTwo[actor.id] = false;
      if (value === 3) moveAndLand(state, actor.id, -2, 0, ctx);
    }
    if (state.winnerId == null && state.pendingSwap == null) {
      const cap = state.nextMoveCap[actor.id];
      state.nextMoveCap[actor.id] = 0;
      moveAndLand(
        state,
        actor.id,
        cap > 0 ? Math.min(value, cap) : value,
        0,
        ctx,
      );
    }
    completeTurn(state, actor.id, ctx);
  },
});

export const FROUSSE_ACTIONS = { roll };

export function requestPawn(
  state: FrousseState,
  actorId: number,
  ctx: RuleContext,
): void {
  const used = new Set(Object.values(state.pawnByPlayerId));
  const available = FROUSSE_PAWNS.filter((pawn) => !used.has(pawn.id));
  ctx.choice.one({
    id: 'frousse.pawn',
    player: actorId,
    options: available.map((pawn) => pawn.id),
    label: (id) => available.find((pawn) => pawn.id === id)?.name ?? id,
  });
}

export function resolvePawn(
  state: FrousseState,
  actorId: number,
  pawnId: string,
  ctx: RuleContext,
): void {
  if (!FROUSSE_PAWNS.some((pawn) => pawn.id === pawnId))
    throw new Error('Pion Frousse invalide');
  if (Object.values(state.pawnByPlayerId).includes(pawnId))
    throw new Error('Pion Frousse déjà choisi');
  state.pawnByPlayerId[actorId] = pawnId;
  const next = ctx.players
    .all()
    .find((player) => state.pawnByPlayerId[player.id] == null);
  if (next) {
    ctx.turn.to(next.id);
    requestPawn(state, next.id, ctx);
    return;
  }
  state.setupComplete = true;
  ctx.transitionTo('playing');
  ctx.turn.to(state.starterId);
}

export function resolveSwap(
  state: FrousseState,
  targetId: number,
  ctx: RuleContext,
): void {
  const pending = state.pendingSwap;
  if (!pending) throw new Error('Échange Frousse absent');
  if (targetId === 0 && !pending.canDecline)
    throw new Error('Échange Frousse obligatoire');
  if (targetId !== 0) {
    if (targetId === pending.actorId || !ctx.players.get(targetId))
      throw new Error('Cible Frousse invalide');
    swapPositions(pending.actorId, targetId, ctx);
  }
  state.pendingSwap = null;
  completeTurn(state, pending.actorId, ctx);
}

export function skipFroussePlayer(state: FrousseState, ctx: RuleContext): void {
  const player = ctx.players.current();
  if (!player) return;
  state.skipTurns[player.id] = Math.max(0, state.skipTurns[player.id] - 1);
  ctx.history.add(`${player.username} passe son tour.`);
  ctx.turn.end();
}

function modifiedRoll(
  state: FrousseState,
  playerId: number,
  ctx: RuleContext,
): number {
  let value: number;
  if (state.nextRollKeepLowest[playerId]) {
    const first = ctx.dice.roll('main').total;
    const second = ctx.dice.roll('main').total;
    value = Math.min(first, second);
    state.nextRollKeepLowest[playerId] = false;
  } else value = ctx.dice.roll('main').total;
  const malus = state.nextRollMalus[playerId];
  state.nextRollMalus[playerId] = 0;
  if (state.nextRollDouble[playerId]) {
    value *= 2;
    state.nextRollDouble[playerId] = false;
  }
  return Math.max(1, value + malus);
}

function passesBlock(value: number, block: FrousseBlock): boolean {
  if (block.kind === 'one-of') return block.allowed.includes(value);
  if (block.kind === 'minimum') return value >= block.minimum;
  return value % 2 === 0;
}

function moveAndLand(
  state: FrousseState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_CHAIN_DEPTH || state.winnerId != null) return;
  moveTo(playerId, bounce(position(playerId, ctx) + delta), ctx);
  resolveLanding(state, playerId, depth + 1, ctx);
}

function resolveLanding(
  state: FrousseState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_CHAIN_DEPTH || state.winnerId != null || state.pendingSwap)
    return;
  const tile = FROUSSE_TILES[position(playerId, ctx)];
  ctx.history.add(
    `${ctx.players.get(playerId)?.username} atteint « ${tile.title} ».`,
  );
  if (tile.type === 'finish') state.winnerId = playerId;
  else if (tile.type === 'card') drawAndApply(state, playerId, depth, ctx);
}

function drawAndApply(
  state: FrousseState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_CHAIN_DEPTH || state.pendingSwap) return;
  const card = ctx.cards.drawOrRecycle<FrousseCard>(DECK);
  if (!card) return;
  ctx.cards.discard(DECK, card);
  ctx.history.add(`Carte ${card.category} : ${card.text}`);
  if (isProtected(state, playerId, card.category)) return;
  applyEffect(state, playerId, card.effect, depth + 1, ctx);
}

function isProtected(
  state: FrousseState,
  playerId: number,
  category: FrousseCategory,
): boolean {
  const untilDraw = state.ignoreTrapUntilNextDraw[playerId];
  state.ignoreTrapUntilNextDraw[playerId] = false;
  if (category === 'trap' && untilDraw) return true;
  if (category === 'trap' && state.ignoreNextTrap[playerId]) {
    state.ignoreNextTrap[playerId] = false;
    return true;
  }
  if (category === 'prank' && state.ignoreNextPrank[playerId]) {
    state.ignoreNextPrank[playerId] = false;
    return true;
  }
  if (category === 'ghost' && state.ignoreNextGhost[playerId]) {
    state.ignoreNextGhost[playerId] = false;
    return true;
  }
  return false;
}

function applyEffect(
  state: FrousseState,
  playerId: number,
  effect: FrousseCardEffect,
  depth: number,
  ctx: RuleContext,
): void {
  if (effect.kind === 'move')
    moveAndLand(state, playerId, effect.delta, depth, ctx);
  else if (effect.kind === 'skip') state.skipTurns[playerId] += effect.turns;
  else if (effect.kind === 'goto') {
    moveTo(playerId, effect.position, ctx);
    resolveLanding(state, playerId, depth, ctx);
  } else if (effect.kind === 'block') {
    state.blocked[playerId] = structuredClone(effect.rule);
    if (effect.replay) state.replayTurns[playerId] += 1;
  } else if (effect.kind === 'cap')
    state.nextMoveCap[playerId] = effect.maximum;
  else if (effect.kind === 'swap')
    requestSwap(state, playerId, effect.canDecline, ctx);
  else if (effect.kind === 'replay')
    applyReplay(state, playerId, effect.modifier);
  else if (effect.kind === 'shield')
    applyShield(state, playerId, effect.category);
  else if (effect.kind === 'double') state.nextRollDouble[playerId] = true;
  else if (effect.kind === 'three-back-two') {
    state.nextRollIfThreeBackTwo[playerId] = true;
    state.replayTurns[playerId] += 1;
  } else {
    for (const player of ctx.players.all())
      if (player.id !== playerId)
        moveAndLand(state, player.id, effect.delta, depth, ctx);
    state.skipTurns[playerId] += effect.turns;
  }
}

function requestSwap(
  state: FrousseState,
  actorId: number,
  canDecline: boolean,
  ctx: RuleContext,
): void {
  const targets = ctx.players.all().filter((player) => player.id !== actorId);
  if (targets.length === 0) return;
  state.pendingSwap = { actorId, canDecline };
  const options = targets.map((player) => player.id);
  if (canDecline) options.push(0);
  ctx.choice.one({
    id: 'frousse.swap',
    player: actorId,
    options,
    label: (id) =>
      id === 0
        ? 'Refuser l’échange'
        : (ctx.players.get(id)?.username ?? `Joueur ${id}`),
  });
}

function applyReplay(
  state: FrousseState,
  playerId: number,
  modifier: 'minus-two' | 'keep-lowest' | undefined,
): void {
  state.replayTurns[playerId] += 1;
  if (modifier === 'minus-two') state.nextRollMalus[playerId] = -2;
  if (modifier === 'keep-lowest') state.nextRollKeepLowest[playerId] = true;
}

function applyShield(
  state: FrousseState,
  playerId: number,
  category: Exclude<FrousseCategory, 'bonus'> | 'trap-until-draw',
): void {
  if (category === 'trap') state.ignoreNextTrap[playerId] = true;
  else if (category === 'prank') state.ignoreNextPrank[playerId] = true;
  else if (category === 'ghost') state.ignoreNextGhost[playerId] = true;
  else state.ignoreTrapUntilNextDraw[playerId] = true;
}

function completeTurn(
  state: FrousseState,
  playerId: number,
  ctx: RuleContext,
): void {
  if (state.winnerId != null || state.pendingSwap) return;
  if (state.replayTurns[playerId] > 0) state.replayTurns[playerId] -= 1;
  else ctx.turn.end();
}

function swapPositions(
  firstId: number,
  secondId: number,
  ctx: RuleContext,
): void {
  const first = position(firstId, ctx);
  const second = position(secondId, ctx);
  moveTo(firstId, second, ctx);
  moveTo(secondId, first, ctx);
}

function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}

function moveTo(playerId: number, target: number, ctx: RuleContext): void {
  ctx.movement.move(TRACK, playerId, target - position(playerId, ctx));
}

function bounce(raw: number): number {
  if (raw < 0) return 0;
  return raw <= FINISH ? raw : Math.max(0, FINISH - (raw - FINISH));
}
