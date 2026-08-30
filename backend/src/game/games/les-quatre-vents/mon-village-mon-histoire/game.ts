import {
  cards,
  collection,
  defineGame,
  defineGameContent,
  raceGame,
} from '../../../engine/sdk/public-api';
import { VILLAGE_TILES, VILLAGE_ZONES } from './content';
import { CARD_COLLECTED, deckForZone, MON_VILLAGE_ACTIONS } from './rules';
import type { MonVillageState } from './types';

const zoneDecks = VILLAGE_ZONES.map((zone) =>
  cards.deck({ id: deckForZone(zone.id), cards: zone.cards, shuffle: true }),
);

export default defineGame<MonVillageState>()({
  id: 'mon-village-mon-histoire',
  displayName: 'Mon Village, Mon Histoire',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Parcourez les métiers qui font vivre un village.',
  players: { min: 2, max: 6 },
  events: [CARD_COLLECTED],
  content: defineGameContent('mon-village-mon-histoire', {
    tiles: VILLAGE_TILES,
    zones: VILLAGE_ZONES,
  }),
  patterns: [raceGame({ trackId: 'village', spaces: VILLAGE_TILES.length })],
  components: [
    ...zoneDecks,
    collection.view({
      id: 'village',
      total: { kind: 'score' },
      groups: Object.fromEntries(
        VILLAGE_ZONES.map((zone) => [
          String(zone.id),
          { kind: 'resource' as const, id: `village-zone-${zone.id}` },
        ]),
      ),
    }),
  ],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'S', type: 'interface', id: 'score' },
  ],
  actions: MON_VILLAGE_ACTIONS,
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
