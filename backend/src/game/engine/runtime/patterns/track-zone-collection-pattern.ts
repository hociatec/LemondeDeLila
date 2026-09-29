import { defineEvent } from '../events/game-event-definition';
import { drawEvent, raceTurn } from './pattern-capabilities';
import { gameInput } from '../actions/game-input-schema';
import type { GameContext } from '../definitions/game-author-context';
import { definePattern } from './gameplay-pattern-core';

export type TrackZoneCollectionOptions = {
  rollRecipe: string;
  trackId: string;
  diceId: string;
  finishReason: string;
  eventNamespace: string;
  collectedEvent: string;
  tiles: readonly {
    n: number;
    title: string;
    description?: string;
    type: 'card' | 'finish';
  }[];
  zones: readonly {
    id: number;
    minimumTile: number;
    maximumTile: number;
    deckId: string;
    resourceId: string;
  }[];
};

type State = Record<string, never>;
type Context = GameContext<State>;
type Card = { id: string | number };

export function trackZoneCollection(source: TrackZoneCollectionOptions) {
  const program = structuredClone(source);
  const collected = defineEvent({
    type: program.collectedEvent,
    data: gameInput.object({
      playerId: gameInput.playerId(),
      zoneId: gameInput.number({ integer: true, min: 1 }),
      cardId: gameInput.number({ integer: true, min: 1 }),
    }),
  });
  return definePattern({
    id: `track-zone-collection:${program.trackId}`,
    mechanics: ['race', 'cards', 'collection', 'ranking'],
    actions: {
      [program.rollRecipe]: raceTurn<State>({
        trackId: program.trackId,
        diceId: program.diceId,
        resolveLanding: ({ playerId, position, ctx }) => {
          const tile = program.tiles[position];
          if (!tile) return;
          ctx.events.message('game.pawn.landed', { playerId, tileId: tile.n });
          if (tile.type === 'finish') {
            finish(program, ctx);
            return;
          }
          const zone = program.zones.find(
            (candidate) =>
              tile.n >= candidate.minimumTile &&
              tile.n <= candidate.maximumTile,
          );
          if (!zone) return;
          const card = drawEvent<State, Card>(ctx, {
            deckId: zone.deckId,
            playerId,
            recycle: true,
            discard: true,
          });
          if (!card) {
            ctx.events.message(`${program.eventNamespace}.zone.empty`, {
              zoneId: zone.id,
            });
            return;
          }
          ctx.score.add(playerId, 1);
          ctx.resources.add(playerId, zone.resourceId, 1);
          ctx.events.message(program.collectedEvent, {
            playerId,
            zoneId: zone.id,
            cardId: card.id,
          });
          collected.emit(ctx, {
            playerId: gameInput.playerId().parse(playerId),
            zoneId: zone.id,
            cardId: gameInput.number({ integer: true, min: 1 }).parse(card.id),
          });
        },
      }),
    },
    events: [collected],
  });
}
function finish(program: TrackZoneCollectionOptions, ctx: Context): void {
  const ranked = ctx.ranking.rank(
    ctx.players.all().map((player) => player.id),
    { value: (id) => ctx.score.get(id), direction: 'desc' },
    ...program.zones.map((zone) => ({
      value: (id: number) => ctx.resources.get(id, zone.resourceId),
      direction: 'desc' as const,
    })),
  );
  const winnerId = ranked[0]?.playerId;
  if (winnerId == null) return;
  ctx.events.message(`${program.eventNamespace}.collection.won`, {
    playerId: winnerId,
    total: ctx.score.get(winnerId),
  });
  ctx.match.finish({ winners: [winnerId], reason: program.finishReason });
}
