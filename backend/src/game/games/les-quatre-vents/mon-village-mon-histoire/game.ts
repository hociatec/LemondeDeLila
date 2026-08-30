import {
  cards,
  collection,
  defineCardsSchema,
  defineGame,
  raceGame,
} from '../../../engine/sdk/public-api';
import { MON_VILLAGE_CONTENT, VILLAGE_TILES, VILLAGE_ZONES } from './content';
import { CARD_COLLECTED, deckForZone, MON_VILLAGE_ACTIONS } from './rules';
import type { MonVillageState } from './types';

const cardSchema = defineCardsSchema({
  decks: Object.fromEntries(
    VILLAGE_ZONES.map((zone) => {
      const id = deckForZone(zone.id);
      return [id, cards.deck({ id, cards: zone.cards, shuffle: true })];
    }),
  ),
  hands: {},
});

export default defineGame<MonVillageState>()({
  id: 'mon-village-mon-histoire',
  displayName: 'Mon Village, Mon Histoire',
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: 'Parcourez les métiers qui font vivre un village.',
  players: { min: 2, max: 6 },
  events: [CARD_COLLECTED],
  content: MON_VILLAGE_CONTENT,
  patterns: [raceGame({ trackId: 'village', spaces: VILLAGE_TILES.length })],
  components: [
    ...cardSchema.components,
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
