import type { GameRuleContext } from '../../../core/application/runtime/game-rule-context';
import {
  CONTES_DECKS,
  CONTES_TILES,
  type ContesCard,
  type ContesCardType,
} from './content';
import type {
  ContesPendingEffect,
  ContesState,
  ContesTargetEffect,
} from './state';

export type ContesRuleContext = GameRuleContext<ContesState>;
type RuleContext = ContesRuleContext;
const TRACK = 'story-road';
const FINISH = CONTES_TILES.length - 1;
const MAX_CHAIN_DEPTH = 32;

export function applyRoll(
  state: ContesState,
  playerId: number,
  value: number,
  ctx: RuleContext,
): void {
  const delta = state.reverseNextTurn[playerId] ? -value : value;
  state.reverseNextTurn[playerId] = false;
  moveAndLand(state, playerId, delta, 0, ctx);
}

export function moveAndLand(
  state: ContesState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_CHAIN_DEPTH || state.winnerId != null) return;
  moveTo(playerId, bounce(position(playerId, ctx) + delta), ctx);
  releaseBlockedPlayers(state, playerId, ctx);
  resolveLanding(state, playerId, depth + 1, ctx);
}

export function resolveLanding(
  state: ContesState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_CHAIN_DEPTH || state.winnerId != null) return;
  const tile = CONTES_TILES[position(playerId, ctx)];
  ctx.history.add(
    `${ctx.players.get(playerId)?.username} atteint « ${tile.label} ».`,
  );
  if (tile.type === 'finish') state.winnerId = playerId;
  else if (tile.type === 'conte')
    drawAndApply(state, playerId, 'conte', depth, ctx);
  else if (tile.type === 'bonus') {
    if (state.noBonusTurns[playerId] === 0)
      drawAndApply(state, playerId, 'bonus', depth, ctx);
  } else if (tile.type === 'malus') {
    if (!consumeMalusProtection(state, playerId, depth, ctx))
      drawAndApply(state, playerId, 'malus', depth, ctx);
  } else if (tile.type === 'surprise')
    drawAndApply(state, playerId, 'surprise', depth, ctx);
}

export function drawAndApply(
  state: ContesState,
  playerId: number,
  type: ContesCardType,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_CHAIN_DEPTH || state.pendingEffect) return;
  const card = ctx.cards.drawOrRecycle<ContesCard>(type);
  if (!card) return;
  ctx.cards.discard(type, card);
  ctx.history.add(`${card.title} : ${card.text}`);
  applyCard(state, playerId, card, depth + 1, ctx);
}

export function applyCard(
  state: ContesState,
  playerId: number,
  card: ContesCard,
  depth: number,
  ctx: RuleContext,
): void {
  if (card.type === 'conte') {
    state.lastConte = {
      playerId,
      title: card.title,
      text: card.text,
      timestamp: ctx.clock.nowIso(),
    };
    if (state.keyOfGold[playerId])
      requestTarget(state, playerId, 'gold-key', ctx);
    return;
  }
  if (card.type === 'bonus') applyBonus(state, playerId, card.id, depth, ctx);
  else if (card.type === 'malus')
    applyMalus(state, playerId, card.id, depth, ctx);
  else applySurprise(state, playerId, card.id, depth, ctx);
}

export function applyBonus(
  state: ContesState,
  playerId: number,
  id: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (id === 1) moveAndLand(state, playerId, 2, depth, ctx);
  else if (id === 2) state.rerollTokens[playerId] += 1;
  else if (id === 3) state.shieldMalus[playerId] += 1;
  else if (id === 4) state.cape[playerId] = true;
  else if (id === 5) requestTarget(state, playerId, 'move-other-two', ctx);
  else if (id === 6) moveAndLand(state, playerId, rollDie(ctx) * 2, depth, ctx);
  else if (id === 7) state.keyOfGold[playerId] = true;
  else if (id === 8) moveAndLand(state, playerId, 3, depth, ctx);
  else if (id === 9) queueDraws(state, playerId, ['bonus', 'surprise']);
  else if (id === 10) requestTarget(state, playerId, 'swap-next-turns', ctx);
  else if (id === 11) {
    for (const player of ctx.players.all())
      if (player.id !== playerId) state.forcedOneTurns[player.id] += 1;
  } else if (id === 12) requestAbundance(state, playerId, ctx);
  else if (id === 13) {
    moveAndLand(state, playerId, 5, depth, ctx);
    state.skipTurns[playerId] += 1;
  } else if (id === 14) state.replaceOne[playerId] = true;
  else if (id === 15) {
    moveAndLand(state, playerId, -2, depth, ctx);
    moveAndLand(state, playerId, 3, depth, ctx);
  }
}

export function applyMalus(
  state: ContesState,
  playerId: number,
  id: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (id === 1) state.skipTurns[playerId] += 1;
  else if (id === 2) moveAndLand(state, playerId, -2, depth, ctx);
  else if (id === 3) swapClosestBehind(playerId, ctx);
  else if (id === 4)
    moveAndLand(state, playerId, Math.floor(rollDie(ctx) / 2), depth, ctx);
  else if (id === 5) state.blockedAt[playerId] = position(playerId, ctx);
  else if (id === 6) state.skipTurns[playerId] += 2;
  else if (id === 7) drawAndApply(state, playerId, 'malus', depth, ctx);
  else if (id === 8) {
    moveAndLand(state, playerId, 3, depth, ctx);
    moveAndLand(state, playerId, -4, depth, ctx);
  } else if (id === 9) drawBonusGift(state, playerId, ctx);
  else if (id === 10) moveAndLand(state, playerId, -rollDie(ctx), depth, ctx);
  else if (id === 11) {
    if (rollDie(ctx) < 4) state.skipTurns[playerId] += 1;
  } else if (id === 12) previousMalus(state, playerId, depth, ctx);
  else if (id === 13) moveAndLand(state, playerId, -2, depth, ctx);
  else if (id === 14) moveTo(playerId, 0, ctx);
  else if (id === 15) state.noBonusTurns[playerId] += 2;
}

export function applySurprise(
  state: ContesState,
  playerId: number,
  id: number,
  depth: number,
  ctx: RuleContext,
): void {
  if (id === 1) moveAndLand(state, playerId, -1, depth, ctx);
  else if (id === 2) moveAndLand(state, playerId, 4, depth, ctx);
  else if (id === 3) drawAndApply(state, playerId, 'bonus', depth, ctx);
  else if (id === 4) {
    const types: ContesCardType[] = ['bonus', 'malus', 'surprise'];
    queueDraws(state, playerId, ctx.random.shuffle(types).slice(0, 2));
  } else if (id === 5) requestLaughter(state, playerId, ctx);
  else if (id === 6) requestTarget(state, playerId, 'swap-positions', ctx);
  else if (id === 7) state.skipTurns[playerId] += 1;
  else if (id === 8) state.reverseNextTurn[playerId] = true;
  else if (id === 9) requestOption(state, playerId, 'song', ctx);
  else if (id === 10) state.protectNextMalus[playerId] = true;
  else if (id === 11) drawAndApply(state, playerId, 'conte', depth, ctx);
  else if (id === 12) moveAndLand(state, playerId, -rollDie(ctx), depth, ctx);
  else if (id === 13) requestOption(state, playerId, 'wish', ctx);
  else if (id === 14) requestTarget(state, playerId, 'steal-token', ctx);
  else if (id === 15) requestTarget(state, playerId, 'travelling-book', ctx);
}

export function applyTarget(
  state: ContesState,
  pending: Extract<ContesPendingEffect, { kind: 'target' }>,
  targetId: number,
  ctx: RuleContext,
): void {
  const actorId = pending.actorId;
  if (pending.effect === 'move-other-two')
    moveAndLand(state, targetId, 2, 0, ctx);
  else if (pending.effect === 'swap-next-turns') {
    state.turnReplacement[actorId] = targetId;
    state.turnReplacement[targetId] = actorId;
  } else if (pending.effect === 'give-bonus') {
    if (pending.cardId == null) throw new Error('Carte à donner absente');
    applyBonus(state, targetId, pending.cardId, 0, ctx);
  } else if (
    pending.effect === 'swap-positions' ||
    pending.effect === 'wish-swap'
  )
    swapPositions(actorId, targetId, ctx);
  else if (pending.effect === 'steal-token' || pending.effect === 'song-steal')
    requestToken(state, actorId, targetId, ctx);
  else if (pending.effect === 'travelling-book') {
    const actorPosition = position(actorId, ctx);
    moveTo(targetId, actorPosition, ctx);
    moveAndLand(state, targetId, 1, 0, ctx);
  } else requestOption(state, actorId, 'gold-key-type', ctx, targetId);
}

export function requestTarget(
  state: ContesState,
  actorId: number,
  effect: ContesTargetEffect,
  ctx: RuleContext,
  cardId?: number,
): void {
  const targets = ctx.players.all().filter((player) => player.id !== actorId);
  if (targets.length === 0) return;
  state.pendingEffect = { kind: 'target', actorId, effect, cardId };
  ctx.choice.one({
    id: 'contes.target',
    player: actorId,
    options: targets.map((player) => player.id),
    label: (id) => ctx.players.get(id)?.username ?? `Joueur ${id}`,
  });
}

export function requestOption(
  state: ContesState,
  actorId: number,
  effect: 'song' | 'wish' | 'gold-key-type',
  ctx: RuleContext,
  targetId?: number,
): void {
  const options =
    effect === 'song'
      ? ['move-three', 'steal-bonus']
      : effect === 'wish'
        ? ['move-two', 'swap', 'draw-bonus']
        : ['bonus', 'malus'];
  state.pendingEffect = { kind: 'option', actorId, effect, targetId };
  ctx.choice.one({ id: 'contes.option', player: actorId, options });
}

export function requestLaughter(
  state: ContesState,
  actorId: number,
  ctx: RuleContext,
): void {
  state.pendingEffect = {
    kind: 'laughter',
    actorId,
    order: ctx.players.all().map((player) => player.id),
    picks: {},
  };
  requestNumber(actorId, ctx);
}

export function requestNumber(playerId: number, ctx: RuleContext): void {
  ctx.choice.one({
    id: 'contes.number',
    player: playerId,
    options: [1, 2, 3],
  });
}

export function requestAbundance(
  state: ContesState,
  actorId: number,
  ctx: RuleContext,
): void {
  const cards = [
    ctx.cards.drawOrRecycle<ContesCard>('bonus'),
    ctx.cards.drawOrRecycle<ContesCard>('bonus'),
  ].filter((card): card is ContesCard => card != null);
  for (const card of cards) ctx.cards.discard('bonus', card);
  if (cards.length === 0) return;
  state.pendingEffect = { kind: 'abundance', actorId, cards };
  ctx.choice.one({
    id: 'contes.card',
    player: actorId,
    options: cards.map((card) => card.id),
    label: (id) => cards.find((card) => card.id === id)?.title ?? String(id),
  });
}

export function drawBonusGift(
  state: ContesState,
  actorId: number,
  ctx: RuleContext,
): void {
  const card = ctx.cards.drawOrRecycle<ContesCard>('bonus');
  if (!card) return;
  ctx.cards.discard('bonus', card);
  requestTarget(state, actorId, 'give-bonus', ctx, card.id);
}

export function requestToken(
  state: ContesState,
  actorId: number,
  targetId: number,
  ctx: RuleContext,
): void {
  const tokens = listTokens(state, targetId);
  if (tokens.length === 0) return;
  state.pendingEffect = { kind: 'token', actorId, targetId, tokens };
  ctx.choice.one({ id: 'contes.token', player: actorId, options: tokens });
}

export function listTokens(state: ContesState, playerId: number): string[] {
  const tokens: string[] = [];
  if (state.rerollTokens[playerId] > 0) tokens.push('parchemin');
  if (state.shieldMalus[playerId] > 0) tokens.push('amulette');
  if (state.cape[playerId]) tokens.push('cape');
  if (state.keyOfGold[playerId]) tokens.push('cle-or');
  if (state.replaceOne[playerId]) tokens.push('feuille');
  if (state.reverseNextTurn[playerId]) tokens.push('livre-envers');
  if (state.protectNextMalus[playerId]) tokens.push('dragon-papier');
  return tokens;
}

export function transferToken(
  state: ContesState,
  fromId: number,
  toId: number,
  token: string,
): void {
  if (token === 'parchemin') {
    state.rerollTokens[fromId] -= 1;
    state.rerollTokens[toId] += 1;
  } else if (token === 'amulette') {
    state.shieldMalus[fromId] -= 1;
    state.shieldMalus[toId] += 1;
  } else {
    const field =
      token === 'cape'
        ? state.cape
        : token === 'cle-or'
          ? state.keyOfGold
          : token === 'feuille'
            ? state.replaceOne
            : token === 'livre-envers'
              ? state.reverseNextTurn
              : state.protectNextMalus;
    field[fromId] = false;
    field[toId] = true;
  }
}

export function queueDraws(
  state: ContesState,
  playerId: number,
  types: ContesCardType[],
): void {
  state.resolvingPlayerId = playerId;
  state.queuedDraws.push(...types);
}

export function drainDraws(state: ContesState, ctx: RuleContext): void {
  let depth = 0;
  while (
    state.pendingEffect == null &&
    state.queuedDraws.length > 0 &&
    depth < MAX_CHAIN_DEPTH
  ) {
    const type = state.queuedDraws.shift();
    const playerId = state.resolvingPlayerId;
    if (!type || playerId == null) break;
    drawAndApply(state, playerId, type, depth, ctx);
    depth += 1;
  }
}

export function consumeMalusProtection(
  state: ContesState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): boolean {
  if (state.cape[playerId]) {
    state.cape[playerId] = false;
    moveAndLand(state, playerId, 1, depth, ctx);
    return true;
  }
  if (state.shieldMalus[playerId] > 0) {
    state.shieldMalus[playerId] -= 1;
    return true;
  }
  if (state.protectNextMalus[playerId]) {
    state.protectNextMalus[playerId] = false;
    return true;
  }
  return false;
}

export function previousMalus(
  state: ContesState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): void {
  let target = position(playerId, ctx) - 1;
  while (target > 0 && CONTES_TILES[target].type !== 'malus') target -= 1;
  moveTo(playerId, Math.max(0, target), ctx);
  if (target > 0) drawAndApply(state, playerId, 'malus', depth, ctx);
}

export function swapClosestBehind(playerId: number, ctx: RuleContext): void {
  const own = position(playerId, ctx);
  const target = ctx.players
    .all()
    .filter(
      (player) => player.id !== playerId && position(player.id, ctx) < own,
    )
    .sort((left, right) => position(right.id, ctx) - position(left.id, ctx))[0];
  if (target) swapPositions(playerId, target.id, ctx);
}

export function releaseBlockedPlayers(
  state: ContesState,
  moverId: number,
  ctx: RuleContext,
): void {
  const reached = position(moverId, ctx);
  for (const player of ctx.players.all()) {
    const blocked = state.blockedAt[player.id];
    if (player.id !== moverId && blocked != null && reached >= blocked)
      state.blockedAt[player.id] = null;
  }
}

export function completeResolution(state: ContesState, ctx: RuleContext): void {
  drainDraws(state, ctx);
  if (state.pendingEffect || state.winnerId != null) return;
  const playerId = state.resolvingPlayerId;
  if (playerId != null) decrementTurnStatuses(state, playerId);
  state.resolvingPlayerId = null;
  endResolvedTurn(state, ctx);
}

export function decrementTurnStatuses(
  state: ContesState,
  playerId: number,
): void {
  if (state.noBonusTurns[playerId] > 0) state.noBonusTurns[playerId] -= 1;
}

export function endResolvedTurn(state: ContesState, ctx: RuleContext): void {
  const slotOwner = state.activeSlotOwnerId;
  if (slotOwner != null) {
    state.activeSlotOwnerId = null;
    ctx.turn.to(slotOwner);
  }
  ctx.turn.end();
}

export function requirePending<TKind extends ContesPendingEffect['kind']>(
  state: ContesState,
  kind: TKind,
  actorId: number,
): Extract<ContesPendingEffect, { kind: TKind }> {
  const pending = state.pendingEffect;
  if (!pending || pending.kind !== kind || pending.actorId !== actorId)
    throw new Error(`Choix Contes ${kind} absent`);
  return pending as Extract<ContesPendingEffect, { kind: TKind }>;
}

export function rollDie(ctx: RuleContext): number {
  return ctx.dice.roll('main').total;
}

export function position(playerId: number, ctx: RuleContext): number {
  return ctx.movement.position(TRACK, playerId);
}

export function moveTo(
  playerId: number,
  target: number,
  ctx: RuleContext,
): void {
  ctx.movement.move(TRACK, playerId, target - position(playerId, ctx));
}

export function swapPositions(
  firstId: number,
  secondId: number,
  ctx: RuleContext,
): void {
  const first = position(firstId, ctx);
  const second = position(secondId, ctx);
  moveTo(firstId, second, ctx);
  moveTo(secondId, first, ctx);
}

export function bounce(raw: number): number {
  if (raw < 0) return 0;
  return raw <= FINISH ? raw : Math.max(0, FINISH - (raw - FINISH));
}

export const CONTES_CONTENT_COUNTS = {
  tiles: CONTES_TILES.length,
  cards: Object.values(CONTES_DECKS).reduce(
    (total, deck) => total + deck.length,
    0,
  ),
};
