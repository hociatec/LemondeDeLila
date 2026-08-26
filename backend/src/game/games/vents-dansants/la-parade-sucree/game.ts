import {
  cardGame,
  defineGame,
  playerView,
  victoryWhen,
} from '../../../core/application/public-api';
import {
  PARADE_CARD_BY_ID,
  PARADE_CARDS,
  PARADE_SEQUENCE,
} from './content';
import {
  candyCounts,
  PARADE_ACTIONS,
  playedCards,
  sequenceIndex,
  winners,
} from './rules';
import type { LaParadeSucreePlayerView, LaParadeSucreeState } from './state';

export default defineGame<
  LaParadeSucreeState,
  typeof PARADE_ACTIONS,
  LaParadeSucreePlayerView
>({
  id: 'la-parade-sucree',
  displayName: 'La Parade Sucrée !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Posez les cartes dans l’ordre et collectionnez les friandises.',
  players: { min: 2, max: 6 },
  patterns: [
    cardGame({
      deckId: 'parade',
      handId: 'players',
      cards: PARADE_CARDS.map((card) => card.id),
    }),
  ],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'S', type: 'action', actionType: 'pass' },
  ],
  setup: ({ players, ctx }) => {
    ctx.cards.deal(
      'parade',
      'players',
      players.map((player) => player.id),
      PARADE_CARDS.length,
    );
    return {};
  },
  actions: PARADE_ACTIONS,
  victory: victoryWhen(({ ctx }) => {
    const complete =
      sequenceIndex(ctx) >= PARADE_SEQUENCE.length ||
      ctx.players
        .all()
        .every((player) => ctx.cards.hand('players', player.id).length === 0);
    return complete
      ? { winnerPlayerIds: winners(ctx), reason: 'parade-complete' }
      : null;
  }),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<string>('players', actor.id) : [];
    const handCounts = ctx.cards.handCounts('players');
    const currentSequenceIndex = sequenceIndex(ctx);
    const played = playedCards(ctx);
    const candies = Object.fromEntries(
      ctx.players
        .all()
        .map((player) => [player.id, candyCounts(player.id, ctx)]),
    );
    const nextCard = PARADE_SEQUENCE[currentSequenceIndex] ?? null;
    const scoreLines = ctx.players
      .all()
      .map(
        (player) =>
          `${player.username}: ${handCounts[player.id] ?? 0} carte(s)`,
      );
    return playerView({
      game: {
        candies,
        sequenceIndex: currentSequenceIndex,
        played,
        nextCard,
      },
      extras: {
        candies: structuredClone(candies),
        cardCatalog: PARADE_CARD_BY_ID,
        nextCard,
        played: played.map(
          (cardId) => PARADE_CARD_BY_ID[cardId]?.name ?? cardId,
        ),
        ui: {
          panels: {
            hand: { title: 'Main', message: hand.join(', ') || 'Main vide.' },
            score: { title: 'Cartes', message: scoreLines.join('\n') },
          },
        },
      },
    });
  },
  bot: {
    choose: ({ actor, ctx }) => {
      const expected = PARADE_SEQUENCE[sequenceIndex(ctx)];
      const cardId = ctx.cards
        .hand<string>('players', actor.id)
        .find((candidate) => PARADE_CARD_BY_ID[candidate]?.value === expected);
      return cardId
        ? { type: 'play_card', payload: { cardId } }
        : { type: 'pass', payload: {} };
    },
  },
});
