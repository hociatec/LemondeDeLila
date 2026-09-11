import {
  cards,
  collection,
  defineCardsSchema,
  defineGame,
  inventory,
  raceGame,
} from '../../../engine/sdk/public-api';
import { PIRATES_CONTENT, PIRATES_GAME_CONTENT } from './content';
import manifest from './manifest.json';
import { GAME_EFFECTS } from './rules';

import { PIRATES_ACTIONS } from './rules';
import type { PiratesState } from './types';

const cardSchema = defineCardsSchema({
  decks: Object.fromEntries(
    (['treasure', 'obstacle', 'bonus'] as const).map((id) => [
      id,
      cards.deck({ id, cards: PIRATES_CONTENT[id], shuffle: true }),
    ]),
  ),
  hands: {},
});

export default defineGame<PiratesState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'LesQuatreVents',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: PIRATES_GAME_CONTENT,
  patterns: [
    raceGame({ trackId: 'island', spaces: PIRATES_CONTENT.tiles.length }),
  ],
  components: [
    ...cardSchema.components,
    ...(['treasure', 'obstacle', 'bonus'] as const).map((kind) =>
      inventory.set({
        id: `pirates-${kind}`,
        items: PIRATES_CONTENT[kind].map((card) => String(card.id)),
        visibility: 'public',
      }),
    ),
    collection.view({
      id: 'pirate-loot',
      groups: {
        treasures: { kind: 'inventory', id: 'pirates-treasure' },
        obstacles: { kind: 'inventory', id: 'pirates-obstacle' },
        bonus: { kind: 'inventory', id: 'pirates-bonus' },
        gold: { kind: 'resource', id: 'pirate-gold' },
      },
    }),
  ],
  initialization: {
    resources: { 'pirate-gold': 0 },
    startRound: false,
  },
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'roll' },
    { key: 'P', type: 'interface', id: 'position' },
    { key: 'S', type: 'interface', id: 'score' },
  ],
  actions: PIRATES_ACTIONS,
  effects: GAME_EFFECTS,
  bot: { choose: () => ({ type: 'roll', payload: {} }) },
});
