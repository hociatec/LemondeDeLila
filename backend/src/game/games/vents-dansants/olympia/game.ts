import {
  cards,
  cardGame,
  defineCardsSchema,
  defineGame,
  defineGameContent,
} from '../../../engine/sdk/public-api';
import { OLYMPIA_DECKS, type OlympiaDeckType } from './content';
import { OLYMPIA_ACTIONS, OLYMPIA_EFFECTS } from './rules';
import type { NoGameState as OlympiaState } from '../../../engine/sdk/public-api';

const DECKS: OlympiaDeckType[] = [
  'divinite',
  'heros',
  'creatures',
  'exploits',
  'actions',
  'attaques',
  'evenements',
];
const extraCards = defineCardsSchema({
  decks: Object.fromEntries(
    DECKS.filter((id) => id !== 'heros' && id !== 'divinite').map((id) => [
      id,
      cards.deck({ id, cards: OLYMPIA_DECKS[id], shuffle: true }),
    ]),
  ),
  hands: {},
});

export default defineGame<OlympiaState>()({
  id: 'olympia',
  displayName: 'Olympia',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Gagnez le prestige suprême du panthéon.',
  players: { min: 2, max: 6 },
  content: defineGameContent('olympia', { decks: OLYMPIA_DECKS }),
  patterns: [
    cardGame({
      deckId: 'heros',
      handId: 'players',
      cards: OLYMPIA_DECKS.heros,
    }),
    cardGame({
      deckId: 'divinite',
      handId: 'divinities',
      cards: OLYMPIA_DECKS.divinite,
      visibility: 'public',
    }),
  ],
  components: [...extraCards.components],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'P', type: 'action', actionType: 'pass' },
  ],
  setup: ({ players, ctx }) => {
    for (const player of players) {
      const divinity = ctx.cards.draw<string>('divinite');
      if (divinity) ctx.cards.give('divinities', player.id, divinity);
      for (let index = 0; index < 2; index += 1) {
        const creature = ctx.cards.draw<string>('creatures');
        if (creature) ctx.cards.give('players', player.id, creature);
      }
      const action =
        ctx.cards.draw<string>('actions') ?? ctx.cards.draw<string>('attaques');
      if (action) ctx.cards.give('players', player.id, action);
    }
    return {};
  },
  actions: OLYMPIA_ACTIONS,
  effects: OLYMPIA_EFFECTS,
  bot: {
    choose: ({ actor, ctx }) => {
      const cardId = ctx.cards.hand<string>('players', actor.id)[0];
      return cardId
        ? { type: 'play_card', payload: { cardId } }
        : { type: 'pass', payload: {} };
    },
  },
});
