import {
  cardGame,
  defineGame,
  defineGameContent,
  inventory,
} from '../../../engine/sdk/public-api';
import { CERCLES_SACRES_DECK } from './content';
import { CERCLES_SACRES_ACTIONS, drawAtTurnStart } from './rules';
import type { CerclesSacresState } from './state';

export default defineGame<CerclesSacresState, typeof CERCLES_SACRES_ACTIONS>({
  id: 'cercles-sacres',
  displayName: 'Cercles Sacrés',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Réunissez les six thèmes pour former trois cercles sacrés.',
  players: { min: 2, max: 6 },
  content: defineGameContent('cercles-sacres', {
    cards: CERCLES_SACRES_DECK,
  }),
  patterns: [
    cardGame({
      deckId: 'sacred-circles',
      handId: 'players',
      cards: CERCLES_SACRES_DECK.map((card) => card.id),
      initialHandSize: 6,
      empty: 'recycle',
      drawAtTurnStart,
    }),
  ],
  components: [
    inventory.set({ id: 'sacred-circles-completed', visibility: 'public' }),
  ],
  shortcuts: [
    { key: 'F', type: 'action', actionType: 'form_circle' },
    { key: 'D', type: 'action', actionType: 'discard_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  actions: CERCLES_SACRES_ACTIONS,
  bot: {
    choose: ({ actor, ctx }) => {
      const available = CERCLES_SACRES_ACTIONS.form_circle.enumerate?.({
        state: ctx.state,
        actor,
        ctx,
      });
      if (available?.[0]) {
        return { type: 'form_circle', payload: available[0] };
      }
      const hand = ctx.cards.hand<string>('players', actor.id);
      return hand.length > 8
        ? { type: 'discard_card', payload: { cardId: hand[0] } }
        : { type: 'pass', payload: {} };
    },
  },
});
