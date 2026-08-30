import {
  cardGame,
  defineGame,
  defineGameContent,
  inventory,
} from '../../../engine/sdk/public-api';
import { LA_GRANDE_MINE_CARDS } from './content';
import {
  drawAtTurnStart,
  enumeratePlays,
  GRANDE_MINE_ACTIONS,
  MINE_DOMAINS,
} from './rules';
import { GRANDE_MINE_EFFECTS } from './effects';
import type { GrandeMineState } from './types';

export default defineGame<GrandeMineState>()({
  id: 'la-grande-mine-de-barbak',
  displayName: 'La Grande Mine de Barbak !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Amassez le meilleur domaine avant l’effondrement.',
  players: { min: 2, max: 6 },
  content: defineGameContent('la-grande-mine-de-barbak', {
    cards: LA_GRANDE_MINE_CARDS,
  }),
  patterns: [
    cardGame({
      deckId: 'mine',
      handId: 'players',
      cards: LA_GRANDE_MINE_CARDS.map((card) => card.id),
      initialHandSize: 5,
      drawAtTurnStart: ({ ctx }) => drawAtTurnStart(ctx),
    }),
  ],
  components: [inventory.set({ id: MINE_DOMAINS, visibility: 'public' })],
  initialization: { scores: 0 },
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  actions: GRANDE_MINE_ACTIONS,
  effects: GRANDE_MINE_EFFECTS,
  bot: {
    choose: ({ actor, ctx }) => {
      const play = enumeratePlays(actor.id, ctx)[0];
      return play
        ? { type: 'play_card', payload: play }
        : { type: 'pass', payload: {} };
    },
  },
});
