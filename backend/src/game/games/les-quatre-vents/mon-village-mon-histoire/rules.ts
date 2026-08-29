import {
  defineEvent,
  gameInput,
  playerId as toPlayerId,
  raceTurn,
  type GameContext,
  type PlayerMap,
} from '../../../engine/sdk/public-api';
import { VILLAGE_TILES } from './content';
import type { MonVillageState, VillageCard, VillageCollection } from './state';

const TRACK = 'village';
const ZONE_RANGES = [
  { min: 1, max: 6, id: 1 },
  { min: 7, max: 13, id: 2 },
  { min: 14, max: 20, id: 3 },
  { min: 21, max: 25, id: 4 },
  { min: 26, max: 31, id: 5 },
  { min: 32, max: 36, id: 6 },
  { min: 37, max: 41, id: 7 },
  { min: 42, max: 42, id: 8 },
] as const;
const CARD_COLLECTED = defineEvent({
  type: 'mon-village.card.collected',
  data: gameInput.object({
    playerId: gameInput.playerId(),
    zoneId: gameInput.number({ integer: true, min: 1 }),
    cardId: gameInput.number({ integer: true, min: 1 }),
  }),
});

export const roll = raceTurn<MonVillageState>({
  trackId: TRACK,
  documentation: 'Lance le dé, déplace le pion et collecte le métier atteint.',
  resolveLanding: ({ playerId, position, ctx }) => {
    const tile = VILLAGE_TILES[position];
    ctx.events.message('game.pawn.landed', { playerId, tileId: tile.n });
    if (tile.type === 'finish') {
      const collections = villageCollections(ctx);
      const winnerId = collectionWinner(collections);
      ctx.events.message('mon-village.collection.won', {
        playerId: winnerId,
        total: collections[winnerId]?.total ?? 0,
      });
      ctx.match.finish({ winners: [winnerId], reason: 'village-complete' });
      return;
    }
    const zoneId = zoneForTile(tile.n);
    if (zoneId != null) collectCard(playerId, zoneId, ctx);
  },
});

export const MON_VILLAGE_ACTIONS = { roll };

export function collectionWinner(
  collections: Readonly<PlayerMap<VillageCollection>>,
): number {
  const ranked = Object.entries(collections)
    .map(([playerId, collection]) => ({
      playerId: Number(playerId),
      collection,
    }))
    .sort(
      (left, right) =>
        right.collection.total - left.collection.total ||
        compareZones(right.collection, left.collection) ||
        left.playerId - right.playerId,
    );
  return ranked[0]?.playerId ?? 0;
}

function compareZones(
  left: VillageCollection,
  right: VillageCollection,
): number {
  for (const zone of ZONE_RANGES) {
    const difference =
      (left.byZone[zone.id] ?? 0) - (right.byZone[zone.id] ?? 0);
    if (difference !== 0) return difference;
  }
  return 0;
}

function collectCard(
  playerId: number,
  zoneId: number,
  ctx: Parameters<typeof roll.execute>[0]['ctx'],
): void {
  const deckId = deckForZone(zoneId);
  const card = ctx.cards.drawOrRecycle<VillageCard>(deckId);
  if (!card) {
    ctx.events.message('mon-village.zone.empty', { zoneId });
    return;
  }
  ctx.cards.discard(deckId, card);
  ctx.score.add(playerId, 1);
  ctx.resources.add(playerId, zoneResource(zoneId), 1);
  ctx.events.message('mon-village.card.collected', {
    playerId,
    zoneId,
    cardId: card.id,
  });
  CARD_COLLECTED.emit(ctx, {
    playerId: toPlayerId(playerId),
    zoneId,
    cardId: card.id,
  });
}

export function zoneForTile(tile: number): number | null {
  return (
    ZONE_RANGES.find((range) => tile >= range.min && tile <= range.max)?.id ??
    null
  );
}

export function deckForZone(zoneId: number): string {
  return `zone-${zoneId}`;
}

export function villageCollections(
  ctx: GameContext<MonVillageState>,
): PlayerMap<VillageCollection> {
  return ctx.players.byId((player) => ({
    total: ctx.score.get(player.id),
    byZone: Object.fromEntries(
      ZONE_RANGES.map((zone) => [
        zone.id,
        ctx.resources.get(player.id, zoneResource(zone.id)),
      ]),
    ),
  }));
}

function zoneResource(zoneId: number): string {
  return `village-zone-${zoneId}`;
}
