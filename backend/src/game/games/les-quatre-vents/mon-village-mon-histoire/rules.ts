import {
  drawEvent,
  defineEvent,
  gameInput,
  playerId as toPlayerId,
  raceTurn,
  type GameContext,
  type PlayerMap,
} from '../../../engine/sdk/public-api';
import { VILLAGE_TILES } from './content';
import type { MonVillageState, VillageCard, VillageCollection } from './types';

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
export const CARD_COLLECTED = defineEvent({
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
      const winnerId = collectionWinner(collections, ctx);
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
  ctx: GameContext<MonVillageState>,
): number {
  const ranked = ctx.ranking.rank(
    Object.keys(collections).map(Number),
    { value: (id) => collections[id].total, direction: 'desc' },
    ...ZONE_RANGES.map((zone) => ({
      value: (id: number) => collections[id].byZone[zone.id] ?? 0,
      direction: 'desc' as const,
    })),
  );
  return ranked[0]?.playerId ?? 0;
}

function collectCard(
  playerId: number,
  zoneId: number,
  ctx: Parameters<typeof roll.execute>[0]['ctx'],
): void {
  const deckId = deckForZone(zoneId);
  const card = drawEvent<MonVillageState, VillageCard>(ctx, {
    deckId: deckId,
    playerId: playerId,
    recycle: true,
    discard: true,
  });
  if (!card) {
    ctx.events.message('mon-village.zone.empty', { zoneId });
    return;
  }

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
