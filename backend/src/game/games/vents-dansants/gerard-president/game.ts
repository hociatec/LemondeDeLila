import {
  cardGame,
  cards,
  defineCardsSchema,
  defineGame,
} from '../../../engine/sdk/public-api';
import { GAME_BOT } from './bot-rules';
import {
  GERARD_GAME_CONTENT,
  GERARD_PRESIDENT_NAME_CARDS,
  GERARD_PRESIDENT_SPECIAL_CARDS,
  GERARD_PRESIDENT_THEME_CARDS,
} from './content';
import { GERARD_EFFECTS } from './effects';
import manifest from './manifest.json';
import { GAME_RULES } from './rule-bindings';
import { GERARD_ACTIONS } from './rules';
import { setupGame } from './setup-rules';
import type { GerardState } from './state';
import { GERARD_PHASES } from './game-constants';

const specialCards = GERARD_PRESIDENT_SPECIAL_CARDS.flatMap((card) => [
  card.id,
  card.id,
]);
const cardSchema = defineCardsSchema({
  decks: {
    themes: cards.deck({
      id: 'themes',
      cards: GERARD_PRESIDENT_THEME_CARDS,
      shuffle: true,
    }),
    names: cards.deck({
      id: 'names',
      cards: GERARD_PRESIDENT_NAME_CARDS,
      shuffle: true,
      empty: 'recycle',
    }),
    specials: cards.deck({
      id: 'specials',
      cards: specialCards,
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    names: cards.hands({
      id: 'names',
      deck: 'names',
      initial: 10,
      visibility: 'owner',
    }),
    specials: cards.hands({
      id: 'specials',
      deck: 'specials',
      initial: 2,
      visibility: 'owner',
    }),
  },
});

export default defineGame<GerardState>()({
  id: manifest.code,
  displayName: manifest.name,
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: manifest.summary,
  players: { min: manifest.minPlayers, max: manifest.maxPlayers },
  content: GERARD_GAME_CONTENT,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'names',
      handId: 'names',
    }),
  ],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_name' },
    { key: 'S', type: 'action', actionType: 'play_special' },
  ],
  setup: setupGame,
  initialPhase: GERARD_PHASES.initialPhase,
  phases: GERARD_PHASES.phases,
  actions: GERARD_ACTIONS,
  effects: GERARD_EFFECTS,
  ...GAME_RULES,
  bot: GAME_BOT,
});
