import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  A_FOND_LES_BALLONS_CARDS,
  A_FOND_LES_BALLONS_PAWNS,
  A_FOND_LES_BALLONS_TILES,
  type BalloonCard,
  type BalloonCardEffect,
  type BalloonTileType,
} from './content';
import type { AFondLesBallonsState } from './state';

type RuleContext = GameRuleContext<AFondLesBallonsState>;
const TRACK = 'balloons';
const DECK = 'loufoque';
const MAX_DEPTH = 12;

export const roll = defineAction<AFondLesBallonsState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé et résout toute la chaîne de cases et cartes.',
  available: ({ state }) => state.setupComplete,
  execute: ({ state, actor, ctx }) => {
    const value = ctx.dice.roll('main').total;
    state.lastRoll = value;
    ctx.history.add(`${actor.username} lance le dé : ${value}.`);
    moveBy(state, actor.id, value, 0, ctx);
    if (state.winnerId != null || state.swapPlayerId != null) return;
    if (state.extraTurn) {
      state.extraTurn = false;
      return;
    }
    finishTurn(state, actor.id, ctx);
  },
});

export const A_FOND_LES_BALLONS_ACTIONS = { roll };

export function resolvePawn(
  state: AFondLesBallonsState,
  actorId: number,
  pawnId: string,
  ctx: RuleContext,
): void {
  if (!A_FOND_LES_BALLONS_PAWNS.some((pawn) => pawn.id === pawnId)) {
    throw new Error('Pion À fond les ballons invalide');
  }
  if (Object.values(state.pawnByPlayerId).includes(pawnId)) {
    throw new Error('Ce pion est déjà attribué');
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
    ctx.turn.to(state.starterId);
  }
}

export function requestPawn(
  state: AFondLesBallonsState,
  playerId: number,
  ctx: RuleContext,
): void {
  const used = new Set(Object.values(state.pawnByPlayerId));
  const choices = A_FOND_LES_BALLONS_PAWNS.filter((pawn) => !used.has(pawn.id));
  ctx.choice.one({
    id: 'a-fond-les-ballons.pawn',
    player: playerId,
    options: choices.map((pawn) => pawn.id),
    label: (pawnId) =>
      choices.find((pawn) => pawn.id === pawnId)?.label ?? pawnId,
  });
}

export function resolveSwap(
  state: AFondLesBallonsState,
  targetId: number,
  ctx: RuleContext,
): void {
  const actorId = state.swapPlayerId;
  if (actorId == null) throw new Error('Aucun échange en attente');
  if (targetId !== 0) {
    if (targetId === actorId || !ctx.players.get(targetId)) {
      throw new Error('Cible d’échange invalide');
    }
    const actorPosition = position(actorId, ctx);
    const targetPosition = position(targetId, ctx);
    moveTo(actorId, targetPosition, ctx);
    moveTo(targetId, actorPosition, ctx);
    ctx.history.add(
      `${ctx.players.get(actorId)?.username} échange sa place avec ${ctx.players.get(targetId)?.username}.`,
    );
  }
  state.swapPlayerId = null;
  finishTurn(state, actorId, ctx);
}

export function skipBlockedPlayer(
  state: AFondLesBallonsState,
  ctx: RuleContext,
): void {
  const player = ctx.players.current();
  if (!player) return;
  state.skipTurns[player.id] = Math.max(0, state.skipTurns[player.id] - 1);
  ctx.history.add(`${player.username} passe son tour.`);
  ctx.turn.end();
}

function moveBy(
  state: AFondLesBallonsState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  const current = position(playerId, ctx);
  const target = bouncedTarget(current + delta);
  landOn(state, playerId, target, depth + 1, ctx);
}

function landOn(
  state: AFondLesBallonsState,
  playerId: number,
  target: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || state.winnerId != null) return;
  moveTo(playerId, target, ctx);
  const tile = A_FOND_LES_BALLONS_TILES[target];
  ctx.history.add(
    `${ctx.players.get(playerId)?.username} atteint « ${tile.label} ».`,
  );
  if (tile.type === 'finish') state.winnerId = playerId;
  else if (tile.type === 'bonus') moveBy(state, playerId, 2, depth, ctx);
  else if (tile.type === 'piege') {
    if (state.trapImmunityTurns[playerId] > 0) {
      ctx.history.add('Le piège est ignoré.');
    } else {
      moveBy(state, playerId, -2, depth, ctx);
    }
  } else if (tile.type === 'glissade') {
    const magnitude = ctx.random.int(3) + 1;
    const direction = ctx.random.int(2) === 0 ? 1 : -1;
    moveBy(state, playerId, magnitude * direction, depth, ctx);
  } else if (tile.type === 'tornade') requestSwap(state, playerId, ctx);
  else if (tile.type === 'chaton') landOn(state, playerId, 0, depth + 1, ctx);
  else if (tile.type === 'folie') drawAndApply(state, playerId, depth, ctx);
}

function drawAndApply(
  state: AFondLesBallonsState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  const card = drawCard(ctx);
  if (!card) return;
  ctx.history.add(`Carte Loufoque : ${card.text}`);
  applyEffect(state, playerId, card.effect, depth + 1, ctx);
}

function applyEffect(
  state: AFondLesBallonsState,
  playerId: number,
  effect: BalloonCardEffect,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || state.winnerId != null) return;
  if (effect.type === 'move') moveBy(state, playerId, effect.value, depth, ctx);
  else if (effect.type === 'skip') state.skipTurns[playerId] += effect.turns;
  else if (effect.type === 'move-all') {
    for (const player of ctx.players.all()) {
      moveBy(state, player.id, effect.value, depth, ctx);
    }
  } else if (effect.type === 'next') {
    moveToNextTile(state, playerId, effect.tile, depth, ctx);
  } else if (effect.type === 'freeze-all') {
    for (const player of ctx.players.all()) state.skipTurns[player.id] += 1;
  } else if (effect.type === 'extra-turn') state.extraTurn = true;
  else if (effect.type === 'repeat-roll-all') {
    for (const player of ctx.players.all()) {
      moveBy(state, player.id, state.lastRoll ?? 0, depth, ctx);
    }
  } else if (effect.type === 'swap') requestSwap(state, playerId, ctx);
  else if (effect.type === 'go-to') {
    landOn(state, playerId, effect.position, depth + 1, ctx);
  } else if (effect.type === 'boutique') {
    const cards = [drawCard(ctx), drawCard(ctx)].filter(
      (card): card is BalloonCard => card != null,
    );
    const selected = cards.sort(
      (left, right) => retreatScore(left) - retreatScore(right),
    )[0];
    if (selected) {
      ctx.history.add(`Boutique : ${selected.text}`);
      applyEffect(state, playerId, selected.effect, depth + 1, ctx);
    }
  } else if (effect.type === 'trap-immunity') {
    state.trapImmunityTurns[playerId] += effect.turns;
  } else if (effect.type === 'random-all') {
    for (const player of ctx.players.all()) {
      moveBy(state, player.id, ctx.random.int(2) === 0 ? -1 : 1, depth, ctx);
    }
  } else if (
    effect.type === 'finish-if-slide' &&
    A_FOND_LES_BALLONS_TILES[position(playerId, ctx)].type === 'glissade'
  ) {
    landOn(
      state,
      playerId,
      A_FOND_LES_BALLONS_TILES.length - 1,
      depth + 1,
      ctx,
    );
  }
}

function moveToNextTile(
  state: AFondLesBallonsState,
  playerId: number,
  type: BalloonTileType,
  depth: number,
  ctx: RuleContext,
): void {
  const current = position(playerId, ctx);
  const next = A_FOND_LES_BALLONS_TILES.findIndex(
    (tile, index) => index > current && tile.type === type,
  );
  if (next >= 0) landOn(state, playerId, next, depth + 1, ctx);
}

function requestSwap(
  state: AFondLesBallonsState,
  playerId: number,
  ctx: RuleContext,
): void {
  if (state.swapPlayerId != null) return;
  state.swapPlayerId = playerId;
  const targets = ctx.players.all().filter((player) => player.id !== playerId);
  ctx.choice.one({
    id: 'a-fond-les-ballons.swap',
    player: playerId,
    options: [...targets.map((player) => player.id), 0],
    label: (targetId) =>
      targetId === 0
        ? 'Ne pas échanger'
        : (ctx.players.get(targetId)?.username ?? `Joueur ${targetId}`),
  });
}

function finishTurn(
  state: AFondLesBallonsState,
  actorId: number,
  ctx: RuleContext,
): void {
  state.trapImmunityTurns[actorId] = Math.max(
    0,
    state.trapImmunityTurns[actorId] - 1,
  );
  ctx.turn.end();
}

function drawCard(ctx: RuleContext): BalloonCard | null {
  const card = ctx.cards.drawOrRecycle<BalloonCard>(DECK);
  if (card) ctx.cards.discard(DECK, card);
  return card;
}

function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}

function moveTo(playerId: number, target: number, ctx: RuleContext): void {
  ctx.movement.move(TRACK, playerId, target - position(playerId, ctx));
}

function bouncedTarget(raw: number): number {
  const finish = A_FOND_LES_BALLONS_TILES.length - 1;
  let target = Math.max(0, raw);
  while (target > finish) target = finish - (target - finish);
  return Math.max(0, target);
}

function retreatScore(card: BalloonCard): number {
  const effect = card.effect;
  if (effect.type === 'go-to' && effect.position === 0) return -200;
  if (effect.type === 'go-to') return -100;
  if (effect.type === 'move' && effect.value < 0) return effect.value;
  if (effect.type === 'move-all' && effect.value < 0) return effect.value;
  return 0;
}

export const A_FOND_CARD_COUNT = A_FOND_LES_BALLONS_CARDS.length;
