import {
  cardGame,
  defineGame,
  inventory,
  playerView,
} from '../../../core/application/public-api';
import { BANDE_A_BANANE_CARD_BY_ID, BANDE_A_BANANE_DECK } from './content';
import {
  BANDE_A_BANANE_ACTIONS,
  BANDE_A_BANANE_EFFECTS,
  bananaTroops,
  drawAtTurnStart,
  drawnPlayerId,
  enumeratePlays,
} from './rules';
import type { BandeABananePlayerView, BandeABananeState } from './state';

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
  setup: () => ({}),
  actions: BANDE_A_BANANE_ACTIONS,
  effects: BANDE_A_BANANE_EFFECTS,
  view: ({ state, actor, ctx }) => {
    const troops = bananaTroops(ctx);
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    const skipTurns = Object.fromEntries(
      ctx.players.all().map((player) => [player.id, ctx.turn.skipCount(player.id)]),
    );
    return playerView({
      game: {
        troops,
        drawnPlayerId: drawnPlayerId(ctx),
        skipTurns,
        winnerId: ctx.match.result()?.winnerPlayerIds[0] ?? null,
      },
      extras: {
        cardCatalog: BANDE_A_BANANE_CARD_BY_ID,
        troops: structuredClone(troops),
        statuses: { skipTurn: skipTurns },
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
                    `${player.username} : ${troops[player.id].length}/5`,
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
