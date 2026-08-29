import {
  drawAndResolve,
  gameEffects,
  rejectRule,
} from '../../../engine/sdk/public-api';
import type {
  GameContext,
  GameEffectInstruction,
} from '../../../engine/sdk/public-api';
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
} from './types';
import { blockedPosition, moveTo, position } from './resolution-support';
import { CONTES_RESOURCES, CONTES_STATUSES } from './constants';
import { listTokens } from './tokens';

export {
  CONTES_CONTENT_COUNTS,
  blockedPosition,
  position,
  requirePending,
  rollDie,
} from './resolution-support';
export { CONTES_RESOURCES, CONTES_STATUSES } from './constants';
export { transferToken } from './tokens';

export type ContesRuleContext = GameContext<ContesState>;
type RuleContext = ContesRuleContext;
const MAX_CHAIN_DEPTH = 32;
const RESOLUTION_FLAG = 'contes.resolution';
type ContesResolution = { playerId: number; types: ContesCardType[] };

export function applyRoll(
  state: ContesState,
  playerId: number,
  value: number,
  ctx: RuleContext,
): void {
  const delta = ctx.status.consume(playerId, CONTES_STATUSES.reverseNextTurn)
    ? -value
    : value;
  moveContesAndResolve(state, playerId, delta, 0, ctx);
}

export function moveContesAndResolve(
  state: ContesState,
  playerId: number,
  delta: number,
  depth: number,
  ctx: RuleContext,
): void {
  ctx.movement.moveAndResolve({
    trackId: 'story-road',
    playerId,
    distance: delta,
    tiles: CONTES_TILES,
    depth: depth + 1,
    maxDepth: MAX_CHAIN_DEPTH,
    blocked: () => ctx.match.lifecycle() === 'finished',
    onLand: ({ position: current, tile }) => {
      releaseBlockedPlayers(state, playerId, ctx);
      applyContesTile(state, playerId, current, tile, depth + 1, ctx);
    },
  });
}

function applyContesTile(
  state: ContesState,
  playerId: number,
  current: number,
  tile: (typeof CONTES_TILES)[number] | undefined,
  depth: number,
  ctx: RuleContext,
): void {
  if (!tile) return;
  ctx.events.message('game.pawn.landed', {
    playerId,
    tileId: current,
  });
  if (tile.type === 'finish') {
    ctx.match.finish({ winners: [playerId], reason: 'story-road-finished' });
  } else if (tile.type === 'conte')
    drawContesCard(state, playerId, 'conte', depth, ctx);
  else if (tile.type === 'bonus') {
    if (!ctx.status.has(playerId, CONTES_STATUSES.noBonus))
      drawContesCard(state, playerId, 'bonus', depth, ctx);
  } else if (tile.type === 'malus') {
    if (!consumeMalusProtection(state, playerId, depth, ctx))
      drawContesCard(state, playerId, 'malus', depth, ctx);
  } else if (tile.type === 'surprise')
    drawContesCard(state, playerId, 'surprise', depth, ctx);
}

export function drawContesCard(
  state: ContesState,
  playerId: number,
  type: ContesCardType,
  depth: number,
  ctx: RuleContext,
): void {
  if (depth > MAX_CHAIN_DEPTH || ctx.choice.current()) return;
  drawAndResolve<ContesState, ContesCard>(ctx, {
    deckId: type,
    playerId,
    resolve: (card) => {
      applyCard(state, playerId, card, depth + 1, ctx);
    },
  });
}

export function applyCard(
  _state: ContesState,
  playerId: number,
  card: ContesCard,
  _depth: number,
  ctx: RuleContext,
): void {
  ctx.effects.schedule(
    ...card.effects.map((effect) => retargetEffect(effect, playerId)),
  );
}

function retargetEffect(
  effect: GameEffectInstruction,
  playerId: number,
): GameEffectInstruction {
  if (
    effect.kind === 'custom' ||
    effect.kind === 'gain-resource' ||
    effect.kind === 'lose-resource' ||
    effect.kind === 'gain-score' ||
    effect.kind === 'skip-turn' ||
    effect.kind === 'add-status' ||
    effect.kind === 'remove-status' ||
    effect.kind === 'move' ||
    effect.kind === 'move-to' ||
    effect.kind === 'draw-cards' ||
    effect.kind === 'discard-random'
  ) {
    return effect.target?.kind === 'self'
      ? { ...effect, target: gameEffects.target.player(playerId) }
      : effect;
  }
  return effect;
}

export function applyTarget(
  state: ContesState,
  actorId: number,
  targetId: number,
  effect: ContesTargetEffect,
  cardId: number | undefined,
  ctx: RuleContext,
): void {
  if (effect === 'move-other-two')
    moveContesAndResolve(state, targetId, 2, 0, ctx);
  else if (effect === 'swap-next-turns') {
    ctx.turn.swapUpcoming(actorId, targetId);
  } else if (effect === 'give-bonus') {
    if (cardId == null) rejectRule('Carte à donner absente');
    const card = CONTES_DECKS.bonus.find(
      (candidate) => candidate.id === cardId,
    );
    if (!card) rejectRule('Carte Bonus absente');
    applyCard(state, targetId, card, 0, ctx);
  } else if (effect === 'swap-positions' || effect === 'wish-swap')
    ctx.movement.swap('story-road', actorId, targetId);
  else if (effect === 'steal-token' || effect === 'song-steal')
    requestToken(state, actorId, targetId, ctx);
  else if (effect === 'travelling-book') {
    const actorPosition = position(actorId, ctx);
    moveTo(targetId, actorPosition, ctx);
    moveContesAndResolve(state, targetId, 1, 0, ctx);
  } else requestOption(state, actorId, 'gold-key-type', ctx, targetId);
}

export function scheduleContesTarget(
  actorId: number,
  effect: ContesTargetEffect,
  ctx: RuleContext,
  cardId?: number,
): void {
  ctx.effects.schedule(
    gameEffects.custom(
      'contes.target',
      { actorId, effect, ...(cardId == null ? {} : { cardId }) },
      gameEffects.target.chosenFrom(
        ctx.players.otherIds(actorId),
        `contes.${effect}`,
        false,
        actorId,
      ),
    ),
    gameEffects.completeTurn(),
  );
}

export function requestOption(
  _state: ContesState,
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
  const pending: ContesPendingEffect = {
    kind: 'option',
    actorId,
    effect,
    targetId,
  };
  ctx.choice.one({
    id: 'contes.option',
    player: actorId,
    options,
    data: pending,
  });
}

export function requestLaughter(
  _state: ContesState,
  actorId: number,
  ctx: RuleContext,
): void {
  const pending: ContesPendingEffect = {
    kind: 'laughter',
    actorId,
    order: ctx.players.all().map((player) => player.id),
    picks: {},
  };
  requestNumber(actorId, ctx, pending);
}

export function requestNumber(
  playerId: number,
  ctx: RuleContext,
  pending: Extract<ContesPendingEffect, { kind: 'laughter' }>,
): void {
  ctx.choice.one({
    id: 'contes.number',
    player: playerId,
    options: [1, 2, 3],
    data: pending,
  });
}

export function requestAbundance(
  _state: ContesState,
  actorId: number,
  ctx: RuleContext,
): void {
  const cards = [
    ctx.cards.drawOrRecycle<ContesCard>('bonus'),
    ctx.cards.drawOrRecycle<ContesCard>('bonus'),
  ].filter((card): card is ContesCard => card != null);
  for (const card of cards) ctx.cards.discard('bonus', card);
  if (cards.length === 0) return;
  const pending: ContesPendingEffect = {
    kind: 'abundance',
    actorId,
    cardIds: cards.map((card) => card.id),
  };
  ctx.choice.one({
    id: 'contes.card',
    player: actorId,
    options: cards.map((card) => card.id),
    data: pending,
    label: (id) => cards.find((card) => card.id === id)?.title ?? String(id),
  });
}

export function drawBonusGift(
  _state: ContesState,
  actorId: number,
  ctx: RuleContext,
): void {
  const card = ctx.cards.drawOrRecycle<ContesCard>('bonus');
  if (!card) return;
  ctx.cards.discard('bonus', card);
  scheduleContesTarget(actorId, 'give-bonus', ctx, card.id);
}

export function requestToken(
  _state: ContesState,
  actorId: number,
  targetId: number,
  ctx: RuleContext,
): void {
  const tokens = listTokens(targetId, ctx);
  if (tokens.length === 0) return;
  const pending: ContesPendingEffect = {
    kind: 'token',
    actorId,
    targetId,
    tokens,
  };
  ctx.choice.one({
    id: 'contes.token',
    player: actorId,
    options: tokens,
    data: pending,
  });
}

export function queueDraws(
  _state: ContesState,
  playerId: number,
  types: ContesCardType[],
  ctx: RuleContext,
): void {
  const resolution = ctx.turn.flags.get<ContesResolution>(RESOLUTION_FLAG);
  ctx.turn.flags.set(RESOLUTION_FLAG, {
    playerId,
    types: [...(resolution?.types ?? []), ...types],
  });
}

export function drainDraws(state: ContesState, ctx: RuleContext): void {
  let depth = 0;
  let resolution = ctx.turn.flags.get<ContesResolution>(RESOLUTION_FLAG);
  while (
    ctx.choice.current() == null &&
    resolution &&
    depth < MAX_CHAIN_DEPTH
  ) {
    const [type, ...remainingTypes] = resolution.types;
    const playerId = resolution.playerId;
    if (!type || playerId == null) break;
    ctx.turn.flags.set(RESOLUTION_FLAG, {
      playerId,
      types: remainingTypes,
    });
    drawContesCard(state, playerId, type, depth, ctx);
    resolution = ctx.turn.flags.get<ContesResolution>(RESOLUTION_FLAG);
    depth += 1;
  }
}

export function consumeMalusProtection(
  state: ContesState,
  playerId: number,
  depth: number,
  ctx: RuleContext,
): boolean {
  if (ctx.status.consume(playerId, CONTES_STATUSES.cape)) {
    moveContesAndResolve(state, playerId, 1, depth, ctx);
    return true;
  }
  if (ctx.resources.has(playerId, CONTES_RESOURCES.shield, 1)) {
    ctx.resources.remove(playerId, CONTES_RESOURCES.shield, 1);
    return true;
  }
  if (ctx.status.consume(playerId, CONTES_STATUSES.protectNextMalus)) {
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
  if (target > 0) drawContesCard(state, playerId, 'malus', depth, ctx);
}

export function swapClosestBehind(playerId: number, ctx: RuleContext): void {
  const own = position(playerId, ctx);
  const target = ctx.players
    .all()
    .filter(
      (player) => player.id !== playerId && position(player.id, ctx) < own,
    )
    .sort((left, right) => position(right.id, ctx) - position(left.id, ctx))[0];
  if (target) ctx.movement.swap('story-road', playerId, target.id);
}

export function releaseBlockedPlayers(
  _state: ContesState,
  moverId: number,
  ctx: RuleContext,
): void {
  const reached = position(moverId, ctx);
  for (const player of ctx.players.all()) {
    const blocked = blockedPosition(ctx, player.id);
    if (player.id !== moverId && blocked != null && reached >= blocked)
      ctx.status.remove(player.id, CONTES_STATUSES.blocked);
  }
}

export function drainResolution(state: ContesState, ctx: RuleContext): void {
  drainDraws(state, ctx);
  if (ctx.choice.current()) return;
  ctx.turn.flags.consume(RESOLUTION_FLAG);
  ctx.turn.complete();
}

export function extendTurnStatus(
  playerId: number,
  statusId: string,
  turns: number,
  ctx: RuleContext,
): void {
  const remaining = ctx.status.get(playerId, statusId)?.remaining ?? 0;
  ctx.status.add(playerId, statusId, {
    turns: remaining + turns,
    scope: 'turn',
  });
}
