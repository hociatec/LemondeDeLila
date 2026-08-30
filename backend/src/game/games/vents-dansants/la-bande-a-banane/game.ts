import {
  cardGame,
  defineGame,
  defineGameContent,
  inventory,
} from '../../../engine/sdk/public-api';
import { BANDE_A_BANANE_DECK } from './content';
import {
  BANDE_A_BANANE_ACTIONS,
  BANDE_A_BANANE_EFFECTS,
  drawAtTurnStart,
  enumeratePlays,
} from './rules';
import type { BandeABananeState } from './types';

export default defineGame<BandeABananeState>()({
  id: 'la-bande-a-banane',
  displayName: 'La Bande à Banane !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Réunissez les cinq espèces pour crier BANAAAANE.',
  players: { min: 2, max: 6 },
  content: defineGameContent('la-bande-a-banane', {
    cards: BANDE_A_BANANE_DECK,
  }),
  patterns: [
    cardGame({
      deckId: 'banana',
      handId: 'players',
      cards: BANDE_A_BANANE_DECK.map((card) => card.id),
      initialHandSize: 5,
      empty: 'recycle',
      drawAtTurnStart,
    }),
  ],
  components: [inventory.set({ id: 'banana-troops', visibility: 'public' })],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  actions: BANDE_A_BANANE_ACTIONS,
  effects: BANDE_A_BANANE_EFFECTS,
  bot: {
    choose: ({ state, actor, ctx }) => {
      const play = enumeratePlays(state, actor.id, ctx)[0];
      return play
        ? { type: 'play_card', payload: play }
        : { type: 'pass', payload: {} };
    },
  },
});
