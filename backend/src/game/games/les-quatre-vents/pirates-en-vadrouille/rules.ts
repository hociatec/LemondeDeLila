import { drawAndResolve, raceTurn } from '../../../core/application/public-api';
import type { GameContext } from '../../../core/application/public-api';
import { PIRATES_CONTENT } from './content';
import type { PirateCard, PiratesState } from './state';

type DeckName = 'bonus' | 'treasure' | 'obstacle';
type RuleContext = GameContext<PiratesState>;

const TRACK = 'island';
const GOLD = 'pirate-gold';
const OBSTACLE_IMMUNITY = 'pirates.obstacle-immunity';
const PIRATE_INVENTORIES = {
  treasure: 'pirates-treasure',
  obstacle: 'pirates-obstacle',
  bonus: 'pirates-bonus',
} as const;
export const roll = raceTurn<PiratesState>({
  trackId: TRACK,
  documentation: 'Lance le dé, avance et résout la case atteinte.',
  resolveLanding: ({ playerId, ctx }) => {
    resolvePirateTile(playerId, ctx);
  },
});

export const PIRATES_ACTIONS = { roll };

function resolvePirateTile(playerId: number, ctx: RuleContext): void {
  ctx.movement.resolveLanding({
    trackId: TRACK,
    playerId,
    tiles: PIRATES_CONTENT.tiles,
    onLand: ({ position, tile }) => {
      if (!tile) return;
      ctx.events.message('game.pawn.landed', { playerId, tileId: position });
      if (
        tile.type === 'bonus' ||
        tile.type === 'treasure' ||
        tile.type === 'obstacle'
      ) {
        resolvePirateCard(playerId, tile.type, ctx);
      } else if (tile.type === 'gold') {
        ctx.resources.add(playerId, GOLD, 1);
      } else if (tile.type === 'finish') {
        finishOrRetreat(playerId, ctx);
      }
    },
  });
}

function resolvePirateCard(
  playerId: number,
  deck: DeckName,
  ctx: RuleContext,
): void {
  drawAndResolve<PiratesState, PirateCard>(ctx, {
    deckId: deck,
    playerId,
    recycle: true,
    discard: true,
    resolve: (card) => {
      addToCollection(playerId, deck, card, ctx);
      if (deck === 'bonus') ctx.effects.schedule(...card.effects);
      if (deck === 'obstacle') applyObstacle(playerId, card, ctx);
    },
  });
}

function applyObstacle(
  playerId: number,
  card: PirateCard,
  ctx: RuleContext,
): void {
  if (consumeObstacleImmunity(playerId, ctx)) {
    ctx.events.message('pirates.obstacle.ignored', {
      playerId,
      cardId: card.id,
    });
    return;
  }
  ctx.effects.schedule(...card.effects);
}

export function stealTreasure(
  actorId: number,
  targetId: number,
  ctx: RuleContext,
): void {
  const cardId = ctx.inventory
    .items(PIRATE_INVENTORIES.treasure, targetId)
    .at(-1);
  if (cardId == null) {
    ctx.events.message('pirates.treasure.none-to-steal', {
      actorId,
      targetId,
    });
    return;
  }
  ctx.inventory.transfer(
    PIRATE_INVENTORIES.treasure,
    targetId,
    actorId,
    cardId,
  );
}

function addToCollection(
  playerId: number,
  deck: DeckName,
  card: PirateCard,
  ctx: RuleContext,
): void {
  const collection = pirateCollectionIds(playerId, ctx);
  const total =
    collection.treasureIds.length +
    collection.obstacleIds.length +
    collection.bonusIds.length;
  if (total >= 5) return;
  ctx.inventory.add(PIRATE_INVENTORIES[deck], playerId, String(card.id));
}

function finishOrRetreat(playerId: number, ctx: RuleContext): void {
  const collection = pirateCollectionIds(playerId, ctx);
  if (
    collection.treasureIds.length >= 3 ||
    ctx.resources.get(playerId, GOLD) >= 3
  ) {
    ctx.match.finish({ winners: [playerId], reason: 'legendary-chest' });
    ctx.events.message('pirates.chest.opened', { playerId });
  } else {
    ctx.movement.move(TRACK, playerId, -2);
    ctx.events.message('pirates.chest.closed', {
      playerId,
      retreat: 2,
    });
  }
}

export function pirateCollectionIds(
  playerId: number,
  ctx: RuleContext,
): import('./state').PirateCollectionState {
  const ids = (kind: DeckName) =>
    ctx.inventory
      .items(PIRATE_INVENTORIES[kind], playerId)
      .map(Number)
      .filter(Number.isInteger);
  return {
    treasureIds: ids('treasure'),
    obstacleIds: ids('obstacle'),
    bonusIds: ids('bonus'),
  };
}

export function obstacleImmunity(playerId: number, ctx: RuleContext): number {
  return ctx.status.get(playerId, OBSTACLE_IMMUNITY)?.remaining ?? 0;
}

function consumeObstacleImmunity(playerId: number, ctx: RuleContext): boolean {
  const remaining = obstacleImmunity(playerId, ctx);
  if (remaining <= 0) return false;
  if (remaining === 1) ctx.status.remove(playerId, OBSTACLE_IMMUNITY);
  else {
    ctx.status.add(playerId, OBSTACLE_IMMUNITY, {
      turns: remaining - 1,
      scope: 'until-used',
    });
  }
  return true;
}
