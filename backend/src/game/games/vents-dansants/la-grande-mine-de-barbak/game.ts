import {
  cardGame,
  defineGame,
  inventory,
  playerView,
} from '../../../core/application/public-api';
import { LA_GRANDE_MINE_CARD_BY_ID, LA_GRANDE_MINE_CARDS } from './content';
import {
  drawAtTurnStart,
  drawnPlayerId,
  enumeratePlays,
  GRANDE_MINE_ACTIONS,
  MINE_DISCARD_NEXT_DRAW,
  MINE_DOMAINS,
  mineDomains,
  scoreDomain,
} from './rules';
import { GRANDE_MINE_EFFECTS } from './effects';
import type { GrandeMinePlayerView, GrandeMineState } from './state';

export default defineGame<
  GrandeMineState,
  typeof GRANDE_MINE_ACTIONS,
  GrandeMinePlayerView
>({
  id: 'la-grande-mine-de-barbak',
  displayName: 'La Grande Mine de Barbak !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Amassez le meilleur domaine avant l’effondrement.',
  players: { min: 2, max: 6 },
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
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: () => ({}),
  actions: GRANDE_MINE_ACTIONS,
  effects: GRANDE_MINE_EFFECTS,
  view: ({ ctx }) => {
    const domains = mineDomains(ctx);
    const discardNextDraw = ctx.players.byId((player) =>
      ctx.status.has(player.id, MINE_DISCARD_NEXT_DRAW),
    );
    const scores = ctx.players.byId((player) =>
      scoreDomain(domains[player.id]),
    );
    const skipTurns = ctx.players.byId((player) =>
      ctx.turn.skipCount(player.id),
    );
    return playerView({
      game: {
        domains,
        discardNextDraw,
        drawnPlayerId: drawnPlayerId(ctx),
        gameOver: ctx.match.lifecycle() === 'finished',
        winnerIds: ctx.match.result()?.winnerPlayerIds ?? [],
        skipTurns,
        scores,
      },
      extras: {
        cardCatalog: LA_GRANDE_MINE_CARD_BY_ID,
        domains: structuredClone(domains),
        scores,
      },
    });
  },
  bot: {
    choose: ({ actor, ctx }) => {
      const play = enumeratePlays(actor.id, ctx)[0];
      return play
        ? { type: 'play_card', payload: play }
        : { type: 'pass', payload: {} };
    },
  },
});
