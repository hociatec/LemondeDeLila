import {
  cards,
  collection,
  defineCardsSchema,
  defineGame,
  raceGame,
} from '../../../engine/sdk/public-api';
import { VOYAGE_CONTENT, VOYAGE_GAME_CONTENT } from './content';
import { VOYAGE_EFFECTS } from './effects';
import manifest from './manifest.json';
import { GAME_RULES } from './rule-bindings';
import {
  VOYAGE_ACTIONS,
  VOYAGE_FINISH_COUNTDOWN,
  VOYAGE_FINISH_STARTED,
} from './rules';
import type { VoyageCollectionKind, VoyageState } from './types';

const deckNames: VoyageCollectionKind[] = [
  'legend',
  'farce',
  'treasure',
  'landscape',
];
const cardSchema = defineCardsSchema({
  decks: Object.fromEntries(
    deckNames.map((id) => [
      id,
      cards.deck({
        id,
        cards: VOYAGE_CONTENT[id],
        shuffle: true,
        empty: 'recycle',
      }),
    ]),
  ),
  hands: {},
});

export default defineGame<VoyageState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: VOYAGE_GAME_CONTENT,
  rulesVersion: '3',
  patterns: [
    raceGame({
      trackId: 'ireland',
      spaces: VOYAGE_CONTENT.tiles.length,
      overshoot: 'bounce',
    }),
  ],
  components: [
    ...cardSchema.components,
    collection.view({
      id: 'voyage',
      groups: Object.fromEntries(
        deckNames.map((kind) => [
          kind,
          { kind: 'resource' as const, id: `voyage.collection.${kind}` },
        ]),
      ),
    }),
  ],
  resourceIds: deckNames.map((kind) => `voyage.collection.${kind}`),
  initialization: {
    counters: {
      [VOYAGE_FINISH_STARTED]: 0,
      [VOYAGE_FINISH_COUNTDOWN]: 0,
    },
    startRound: false,
  },
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'C', type: 'interface', id: 'cards' },
  ],
  ...GAME_RULES,
  actions: VOYAGE_ACTIONS,
  effects: VOYAGE_EFFECTS,

  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
