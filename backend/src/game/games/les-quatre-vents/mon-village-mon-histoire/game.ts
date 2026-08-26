import {
  cards,
  defineGame,
  playerView,
  raceGame,
} from '../../../core/application/public-api';
import { VILLAGE_TILES, VILLAGE_ZONE_LABELS, VILLAGE_ZONES } from './content';
import {
  collectionWinner,
  deckForZone,
  MON_VILLAGE_ACTIONS,
  villageCollections,
} from './rules';
import type { MonVillagePlayerView, MonVillageState } from './state';

const zoneDecks = VILLAGE_ZONES.map((zone) =>
  cards.deck({ id: deckForZone(zone.id), cards: zone.cards, shuffle: true }),
);

export default defineGame<
  MonVillageState,
  typeof MON_VILLAGE_ACTIONS,
  MonVillagePlayerView
>({
  id: 'mon-village-mon-histoire',
  displayName: 'Mon Village, Mon Histoire',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Parcourez les métiers qui font vivre un village.',
  players: { min: 2, max: 6 },
  patterns: [raceGame({ trackId: 'village', spaces: VILLAGE_TILES.length })],
  components: [...zoneDecks],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'S', type: 'interface', id: 'score' },
  ],
  setup: () => ({}),
  actions: MON_VILLAGE_ACTIONS,
  view: ({ actor, ctx }) => {
    const collections = villageCollections(ctx);
    const positions = ctx.players.byId((player) =>
      ctx.movement.position('village', player.id),
    );
    const availableCards = Object.fromEntries(
      VILLAGE_ZONES.map((zone) => [
        zone.id,
        ctx.cards.deckCount(deckForZone(zone.id)) +
          ctx.cards.discardCount(deckForZone(zone.id)),
      ]),
    );
    const scoreLines = ctx.players.all().map((player) => {
      const collection = collections[player.id];
      const zones = Object.entries(collection.byZone)
        .sort(([left], [right]) => Number(left) - Number(right))
        .map(
          ([zoneId, count]) =>
            `${VILLAGE_ZONE_LABELS[Number(zoneId)] ?? `Zone ${zoneId}`} (${count})`,
        );
      return `${player.username} : ${collection.total}${zones.length ? ` | ${zones.join(' | ')}` : ''}`;
    });
    return playerView({
      game: {
        collections,
        availableCards,
      },
      extras: {
        currentPlayerView: actor
          ? { id: actor.id, username: actor.username }
          : null,
        scoreLeaderId: collectionWinner(collections),
        ui: {
          panels: [
            { title: 'Collections', lines: scoreLines },
            {
              title: 'Cartes disponibles',
              lines: VILLAGE_ZONES.map(
                (zone) => `${zone.title} : ${availableCards[zone.id]}`,
              ),
            },
          ],
        },
      },
      board: { tiles: VILLAGE_TILES, positions },
    });
  },
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
