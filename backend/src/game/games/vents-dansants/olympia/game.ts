import type { NoGameState as OlympiaState } from '../../../engine/sdk/public-api';
import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import {
  OLYMPIA_DECKS,
  OLYMPIA_GAME_CONTENT,
  type OlympiaDeckType,
} from './content';
import manifest from './manifest.json';
import { OLYMPIA_ACTIONS, OLYMPIA_EFFECTS } from './rules';
import { setupGame } from './setup-rules';

const DECKS: OlympiaDeckType[] = [
  'divinite',
  'heros',
  'creatures',
  'exploits',
  'actions',
  'attaques',
  'evenements',
];
const cardSchema = defineCardsSchema({
  decks: Object.fromEntries(
    DECKS.map((id) => [
      id,
      cards.deck({
        id,
        cards: OLYMPIA_DECKS[id],
        shuffle: true,
        ...(id === 'heros' || id === 'divinite'
          ? { empty: 'recycle' as const }
          : {}),
      }),
    ]),
  ),
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'heros',
      initial: 0,
      visibility: 'owner',
    }),
    divinities: cards.hands({
      id: 'divinities',
      deck: 'divinite',
      initial: 0,
      visibility: 'public',
    }),
  },
});

export default defineGame<OlympiaState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: OLYMPIA_GAME_CONTENT,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'heros',
      handId: 'players',
    }),
  ],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'P', type: 'action', actionType: 'pass' },
  ],
  setup: setupGame,
  actions: OLYMPIA_ACTIONS,
  effects: OLYMPIA_EFFECTS,
  bot: GAME_BOT,
});
