import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
  inventory,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import { ENTRE_RITES_DECK, ENTRE_RITES_GAME_CONTENT } from './content';
import { ENTRE_RITES_EFFECTS } from './effects';
import manifest from './manifest.json';
import { GAME_RULES } from './rule-bindings';
import { ENTRE_RITES_ACTIONS, RITES_SPECIALS } from './rules';
import { setupGame } from './setup-rules';
import type { EntreRitesState } from './types';

const familySets = cards.sets({
  id: 'rite-families',
  hand: 'players',
  deck: 'rites',
  visibility: 'public',
  sets: ENTRE_RITES_DECK.reduce<Record<string, string[]>>((sets, card) => {
    if (card.type === 'family') (sets[card.familyId] ??= []).push(card.id);
    return sets;
  }, {}),
});
const cardSchema = defineCardsSchema({
  decks: {
    rites: cards.deck({
      id: 'rites',
      cards: ENTRE_RITES_DECK.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'rites',
      initial: 0,
      visibility: 'owner',
    }),
  },
});

export default defineGame<EntreRitesState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: ENTRE_RITES_GAME_CONTENT,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'rites',
      handId: 'players',
    }),
  ],
  components: [
    familySets,
    inventory.set({ id: RITES_SPECIALS, visibility: 'public' }),
  ],
  shortcuts: [
    { key: 'D', type: 'action', actionType: 'ask_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: setupGame,
  ...GAME_RULES,
  actions: ENTRE_RITES_ACTIONS,
  effects: ENTRE_RITES_EFFECTS,

  bot: GAME_BOT,
});
