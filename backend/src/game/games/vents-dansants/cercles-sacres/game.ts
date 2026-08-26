import {
  cardGame,
  defineGame,
  inventory,
  playerView,
} from '../../../core/application/public-api';
import { CERCLES_SACRES_CARD_BY_ID, CERCLES_SACRES_DECK } from './content';
import {
  CERCLES_SACRES_ACTIONS,
  drawAtTurnStart,
  sacredCircles,
} from './rules';
import type { CerclesSacresPlayerView, CerclesSacresState } from './state';

export default defineGame<
  CerclesSacresState,
  typeof CERCLES_SACRES_ACTIONS,
  CerclesSacresPlayerView
>({
  id: 'cercles-sacres',
  displayName: 'Cercles Sacrés',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Réunissez les six thèmes pour former trois cercles sacrés.',
  players: { min: 2, max: 6 },
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
  setup: () => ({}),
  actions: CERCLES_SACRES_ACTIONS,
  view: ({ state: _state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    const circles = sacredCircles(ctx);
    return playerView({
      game: {
        circles,
      },
      extras: {
        circles: structuredClone(circles),
        cardCatalog: CERCLES_SACRES_CARD_BY_ID,
        ui: {
          panels: [
            {
              title: 'Main',
              lines: hand.map(
                (cardId) => CERCLES_SACRES_CARD_BY_ID[cardId]?.name ?? cardId,
              ),
            },
            {
              title: 'Cercles',
              lines: ctx.players
                .all()
                .map(
                  (player) =>
                    `${player.username} : ${circles[player.id].length}`,
                ),
            },
          ],
        },
      },
    });
  },
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
