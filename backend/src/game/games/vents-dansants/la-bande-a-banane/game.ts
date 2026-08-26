import {
  cards,
  clockwise,
  defineGame,
  playerView,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import { BANDE_A_BANANE_CARD_BY_ID, BANDE_A_BANANE_DECK } from './content';
import {
  BANDE_A_BANANE_ACTIONS,
  drawAtTurnStart,
  enumeratePlays,
  skipPenalizedPlayer,
} from './rules';
import type { BandeABananePlayerView, BandeABananeState } from './state';

const deck = cards.deck({
  id: 'banana',
  cards: BANDE_A_BANANE_DECK.map((card) => card.id),
  shuffle: true,
});
const hands = cards.hands({
  id: 'players',
  deck: 'banana',
  initial: 5,
  visibility: 'owner',
});

export default defineGame<
  BandeABananeState,
  typeof BANDE_A_BANANE_ACTIONS,
  BandeABananePlayerView
>({
  id: 'la-bande-a-banane',
  displayName: 'La Bande à Banane !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Réunissez les cinq espèces pour crier BANAAAANE.',
  players: { min: 2, max: 6 },
  components: [deck, hands],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: ({ players }) => ({
    troops: Object.fromEntries(players.map((player) => [player.id, []])),
    skipTurns: Object.fromEntries(players.map((player) => [player.id, 0])),
    drawnPlayerId: null,
    winnerId: null,
  }),
  turn: clockwise(),
  actions: BANDE_A_BANANE_ACTIONS,
  automatic: [
    when(
      'skip-penalized-player',
      ({ state, ctx }) =>
        (state.skipTurns[ctx.players.current()?.id ?? 0] ?? 0) > 0,
      ({ state, ctx }) => skipPenalizedPlayer(state, ctx),
    ),
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
      : { winnerPlayerIds: [state.winnerId], reason: 'five-species' },
  ),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    const handCounts = ctx.cards.handCounts('players');
    return playerView({
      game: {
        ...structuredClone(state),
        hand: structuredClone(hand),
        handCounts,
        deckCount: ctx.cards.deckCount('banana'),
        discardCount: ctx.cards.discardCount('banana'),
      },
      extras: {
        hand: structuredClone(hand),
        handCounts,
        troops: structuredClone(state.troops),
        statuses: { skipTurn: structuredClone(state.skipTurns) },
        ui: {
          panels: [
            {
              title: 'Main',
              lines: hand.map(
                (cardId) => BANDE_A_BANANE_CARD_BY_ID[cardId]?.name ?? cardId,
              ),
            },
            {
              title: 'Troupes',
              lines: ctx.players
                .all()
                .map(
                  (player) =>
                    `${player.username} : ${state.troops[player.id].length}/5`,
                ),
            },
          ],
        },
      },
    });
  },
  bot: {
    choose: ({ state, actor, ctx }) => {
      const play = enumeratePlays(state, actor.id, ctx)[0];
      return play
        ? { type: 'play_card', payload: play }
        : { type: 'pass', payload: {} };
    },
  },
});
