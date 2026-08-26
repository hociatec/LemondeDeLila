import { defineAction, gameInput } from '../../../core/application/public-api';
import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import { MAMAN_CONTENT } from './content';
import type {
  MamanCard,
  MamanPendingChoice,
  MamanTileType,
  ToutPresDeMamanState,
} from './state';

const TRACK = 'forest';
const DECK = 'events';
const TOKENS_TO_WIN = 3;
const MAX_DEPTH = 12;

type RuleContext = GameRuleContext<ToutPresDeMamanState>;

export const roll = defineAction<ToutPresDeMamanState, Record<string, never>>({
  input: gameInput.object({}),
  documentation: 'Lance le dé et résout la chaîne d’effets de la forêt.',
  execute: ({ state, actor, ctx }) => {
    let total = ctx.dice.roll('main').total;
    if (state.bonusReroll[actor.id]) {
      state.bonusReroll[actor.id] = false;
      total += ctx.dice.roll('main').total;
    }
    state.lastRoll = total;
    const current = ctx.movement.position(TRACK, actor.id);
    const last = MAMAN_CONTENT.tiles.length - 1;
    const rawTarget = current + total;
    const target =
      rawTarget > last ? Math.max(0, last - (rawTarget - last)) : rawTarget;
    setPosition(actor.id, target, ctx);
    ctx.history.add(`${actor.username} avance de ${total} case(s).`);
    applyTile(state, actor.id, target, 0, ctx);
    if (state.winnerId == null && state.pendingChoice == null) ctx.turn.end();
  },
});

export const TOUT_PRES_DE_MAMAN_ACTIONS = { roll };

export function resolveMamanChoice(
  state: ToutPresDeMamanState,
  targetId: number,
  ctx: RuleContext,
): void {
  const pending = state.pendingChoice;
  if (!pending) throw new Error('Choix koala introuvable');
  state.pendingChoice = null;
  if (pending.kind === 'transfer-token') {
    if (state.tokens[pending.actorId] > 0) {
      state.tokens[pending.actorId] -= 1;
      state.tokens[targetId] += 1;
    }
  } else if (pending.kind === 'share-advance') {
    moveAndApply(state, targetId, 1, pending.depth, ctx);
  } else {
    moveAndApply(state, pending.actorId, 1, pending.depth, ctx);
    if (state.pendingChoice == null) {
      moveAndApply(state, targetId, 1, pending.depth, ctx);
    }
  }
  if (state.winnerId == null && state.pendingChoice == null) ctx.turn.end();
}

export function skipRestingPlayer(
  state: ToutPresDeMamanState,
  ctx: RuleContext,
): void {
  const current = ctx.players.current();
  if (!current) return;
  state.skipTurns[current.id] = Math.max(0, state.skipTurns[current.id] - 1);
  ctx.history.add(`${current.username} reste au nid et saute son tour.`);
  ctx.turn.end();
}

function applyTile(
  state: ToutPresDeMamanState,
  playerId: number,
  position: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH || state.pendingChoice != null) return;
  const tile = MAMAN_CONTENT.tiles[position];
  if (!tile) return;
  if (tile.type === 'start') gainTokens(state, playerId, 2);
  else if (tile.type === 'token') gainTokens(state, playerId, 1);
  else if (tile.type === 'card')
    drawAndApplyCard(state, playerId, depth + 1, ctx);
  else if (tile.type === 'bonds')
    moveAndApply(state, playerId, 2, depth + 1, ctx);
  else if (tile.type === 'slide')
    moveAndApply(state, playerId, -2, depth + 1, ctx);
  else if (tile.type === 'storm' || tile.type === 'nest')
    state.skipTurns[playerId] += 1;
  else if (tile.type === 'meeting')
    requestChoice(state, 'meeting', playerId, depth + 1, ctx);
  else if (tile.type === 'finish')
    finishOrRewind(state, playerId, position, depth + 1, ctx);
}

function drawAndApplyCard(
  state: ToutPresDeMamanState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  const card = ctx.cards.drawOrRecycle<MamanCard>(DECK);
  if (!card) return;
  ctx.cards.discard(DECK, card);
  ctx.history.add(`Carte : ${card.text}`);
  applyCard(state, playerId, card.id, depth, ctx);
}

function applyCard(
  state: ToutPresDeMamanState,
  playerId: number,
  cardId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_DEPTH) return;
  if (cardId === 1 || cardId === 30)
    moveAndApply(state, playerId, 1, depth + 1, ctx);
  else if (cardId === 2 || cardId === 17)
    moveAndApply(state, playerId, -1, depth + 1, ctx);
  else if ([3, 12, 20].includes(cardId)) gainTokens(state, playerId, 1);
  else if ([4, 18].includes(cardId))
    moveAndApply(state, playerId, 2, depth + 1, ctx);
  else if ([5, 13, 22, 28].includes(cardId)) state.skipTurns[playerId] += 1;
  else if ([6, 19].includes(cardId))
    moveAndApply(state, playerId, -2, depth + 1, ctx);
  else if (cardId === 7) moveToType(state, playerId, 'card', 1, depth + 1, ctx);
  else if (cardId === 8)
    requestChoice(state, 'transfer-token', playerId, depth, ctx);
  else if (cardId === 9)
    moveToType(state, playerId, 'token', -1, depth + 1, ctx);
  else if (cardId === 10) moveEveryone(state, -1, depth + 1, ctx);
  else if (cardId === 11) state.bonusReroll[playerId] = true;
  else if (cardId === 14) moveAndApply(state, playerId, 3, depth + 1, ctx);
  else if (cardId === 15)
    moveToType(state, playerId, 'bonds', -1, depth + 1, ctx);
  else if (cardId === 16)
    moveAndApply(state, playerId, ctx.dice.roll('main').total, depth + 1, ctx);
  else if (cardId === 21) moveEveryone(state, 1, depth + 1, ctx);
  else if (cardId === 23 && ctx.dice.roll('main').total >= 4) {
    moveAndApply(state, playerId, 1, depth + 1, ctx);
  } else if (cardId === 24)
    moveToType(state, playerId, 'bonds', 1, depth + 1, ctx);
  else if (cardId === 25)
    state.tokens[playerId] = Math.max(0, state.tokens[playerId] - 1);
  else if (cardId === 26) {
    moveAndApply(state, playerId, 1, depth + 1, ctx);
    if (state.pendingChoice == null)
      requestChoice(state, 'share-advance', playerId, depth, ctx);
  } else if (cardId === 29) {
    moveAndApply(state, playerId, 2, depth + 1, ctx);
    gainTokens(state, playerId, 1);
  }
}

function moveAndApply(
  state: ToutPresDeMamanState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (state.pendingChoice != null) return;
  const position = ctx.movement.move(TRACK, playerId, delta);
  applyTile(state, playerId, position, depth, ctx);
}

function moveToType(
  state: ToutPresDeMamanState,
  playerId: number,
  type: MamanTileType,
  direction: 1 | -1,
  depth: number,
  ctx: RuleContext,
): void {
  const current = ctx.movement.position(TRACK, playerId);
  let index = current + direction;
  while (index >= 0 && index < MAMAN_CONTENT.tiles.length) {
    if (MAMAN_CONTENT.tiles[index].type === type) {
      setPosition(playerId, index, ctx);
      applyTile(state, playerId, index, depth, ctx);
      return;
    }
    index += direction;
  }
}

function moveEveryone(
  state: ToutPresDeMamanState,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  for (const player of ctx.players.all()) {
    if (state.pendingChoice != null) return;
    moveAndApply(state, player.id, delta, depth, ctx);
  }
}

function finishOrRewind(
  state: ToutPresDeMamanState,
  playerId: number,
  position: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (state.tokens[playerId] >= TOKENS_TO_WIN) {
    state.winnerId = playerId;
    return;
  }
  const rewind = Math.min(position, TOKENS_TO_WIN - state.tokens[playerId]);
  setPosition(playerId, position - rewind, ctx);
  applyTile(state, playerId, position - rewind, depth, ctx);
}

function requestChoice(
  state: ToutPresDeMamanState,
  kind: MamanPendingChoice['kind'],
  actorId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (kind === 'transfer-token' && state.tokens[actorId] === 0) return;
  const options = ctx.players
    .all()
    .filter((player) => player.id !== actorId)
    .map((player) => player.id);
  if (options.length === 0) return;
  state.pendingChoice = { kind, actorId, depth };
  ctx.choice.one({
    id: 'maman.target',
    player: actorId,
    options,
    label: (targetId) =>
      ctx.players.get(targetId)?.username ?? String(targetId),
  });
}

function setPosition(
  playerId: number,
  position: number,
  ctx: RuleContext,
): void {
  const current = ctx.movement.position(TRACK, playerId);
  ctx.movement.move(TRACK, playerId, position - current);
}

function gainTokens(
  state: ToutPresDeMamanState,
  playerId: number,
  amount: number,
): void {
  state.tokens[playerId] += amount;
}
