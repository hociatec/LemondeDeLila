import {
  cards,
  clockwise,
  defineGame,
  playerView,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import { CERCLES_SACRES_CARD_BY_ID, CERCLES_SACRES_DECK } from './content';
import { CERCLES_SACRES_ACTIONS, drawAtTurnStart } from './rules';
import type { CerclesSacresPlayerView, CerclesSacresState } from './state';

const deck = cards.deck({
  id: 'sacred-circles',
  cards: CERCLES_SACRES_DECK.map((card) => card.id),
  shuffle: true,
});
const hands = cards.hands({
  id: 'players',
  deck: 'sacred-circles',
  initial: 6,
  visibility: 'owner',
});

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
  components: [deck, hands],
  shortcuts: [
    { key: 'F', type: 'action', actionType: 'form_circle' },
    { key: 'D', type: 'action', actionType: 'discard_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: ({ players }) => ({
    circles: Object.fromEntries(players.map((player) => [player.id, []])),
    drawnPlayerId: null,
    winnerId: null,
  }),
  turn: clockwise(),
  actions: CERCLES_SACRES_ACTIONS,
  automatic: [
    when(
      'draw-at-turn-start',
      ({ state, ctx }) =>
        state.drawnPlayerId !== (ctx.players.current()?.id ?? null),
      ({ state, ctx }) => drawAtTurnStart(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'three-circles' },
  ),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    const handCounts = ctx.cards.handCounts('players');
    const discardCount = ctx.cards.discardCount('sacred-circles');
    const deckCount = ctx.cards.deckCount('sacred-circles');
    return playerView({
      game: {
        ...structuredClone(state),
        hand: structuredClone(hand),
        handCounts,
        deckCount,
        discardCount,
      },
      extras: {
        hand: structuredClone(hand),
        handCounts,
        circles: structuredClone(state.circles),
        deckCount,
        discardCount,
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
                    `${player.username} : ${state.circles[player.id].length}`,
                ),
            },
          ],
        },
      },
    });
  },
  bot: {
    choose: ({ actor, ctx }) => {
      const available = CERCLES_SACRES_ACTIONS.form_circle.availableInputs?.({
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
