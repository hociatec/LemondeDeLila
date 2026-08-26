import {
  cards,
  clockwise,
  defineGame,
  playerView,
  victoryWhen,
  when,
} from '../../../core/application/public-api';
import { LAMA_MAX_DECK, type LamaCard } from './content';
import {
  LAMA_ACTIONS,
  resolvePause,
  resolveReturn,
  skipInactiveLamaPlayer,
} from './rules';
import type { LamaPlayerView, LamaState } from './state';

export default defineGame<LamaState, typeof LAMA_ACTIONS, LamaPlayerView>({
  id: 'lama',
  displayName: 'LAMA',
  category: 'JeuxDeCartes',
  subcategory: 'VentsSacres',
  description:
    'Défaussez vos cartes ou quittez la manche pour limiter vos jetons.',
  players: { min: 2, max: 6 },
  components: [
    cards.deck({ id: 'lama', cards: LAMA_MAX_DECK, shuffle: true }),
    cards.hands({
      id: 'lama-hands',
      deck: 'lama',
      initial: 0,
      visibility: 'owner',
    }),
  ],
  setup: ({ players, ctx }) => {
    const ownerId =
      players.find((player) => !player.isBot)?.id ?? players[0].id;
    ctx.turn.to(ownerId);
    return {
      ownerId,
      configured: false,
      config: {
        loseAtScore: 40,
        roundPauseSeconds: 0,
        allowPlayAfterDraw: false,
        startingHandSize: 6,
        copiesPerCardValue: 8,
        returnTokenFromRound: 2,
      },
      scores: Object.fromEntries(players.map((player) => [player.id, 0])),
      eliminated: Object.fromEntries(
        players.map((player) => [player.id, false]),
      ),
      droppedOut: Object.fromEntries(
        players.map((player) => [player.id, false]),
      ),
      drawnThisTurn: false,
      roundNumber: 1,
      roundStarterIndex: 0,
      step: 'setup',
      roundWinnerId: null,
      winnerId: null,
    };
  },
  initialPhase: 'setup',
  turn: clockwise(),
  actions: LAMA_ACTIONS,
  choices: {
    'lama.return': {
      resolve: ({ state, value, ctx }) =>
        resolveReturn(state, Number(value), ctx),
    },
    'lama.pause': {
      resolve: ({ state, ctx }) => resolvePause(state, ctx),
    },
  },
  automatic: [
    when(
      'skip-inactive-lama-player',
      ({ state, ctx }) => {
        const currentId = ctx.players.current()?.id ?? 0;
        return (
          state.step === 'turn' &&
          (state.eliminated[currentId] || state.droppedOut[currentId])
        );
      },
      ({ state, ctx }) => skipInactiveLamaPlayer(state, ctx),
    ),
  ],
  victory: victoryWhen(({ state }) =>
    state.winnerId == null
      ? null
      : { winnerPlayerIds: [state.winnerId], reason: 'last-below-limit' },
  ),
  view: ({ state, actor, ctx }) => {
    const hand = actor ? ctx.cards.hand<LamaCard>('lama-hands', actor.id) : [];
    const discard = ctx.cards.discardPile<LamaCard>('lama');
    return playerView({
      game: {
        ...structuredClone(state),
        hand: [...hand],
        handCounts: ctx.cards.handCounts('lama-hands'),
        topCard: discard.at(-1) ?? null,
        deckCount: ctx.cards.deckCount('lama'),
      },
      extras: { hand: [...hand], scores: structuredClone(state.scores) },
    });
  },
  bot: {
    choose: ({ state, actor, availableActions, ctx }) => {
      if (availableActions.includes('lama_set_config'))
        return { type: 'lama_set_config', payload: {} };
      if (availableActions.includes('lama_play')) {
        const discard = ctx.cards.discardPile<LamaCard>('lama');
        const top = discard.at(-1);
        const playable = ctx.cards
          .hand<LamaCard>('lama-hands', actor.id)
          .find(
            (card) =>
              top != null &&
              (card === top || card === (top === 7 ? 1 : top + 1)),
          );
        if (playable != null)
          return { type: 'lama_play', payload: { value: playable } };
      }
      if (availableActions.includes('draw'))
        return { type: 'draw', payload: {} };
      if (state.drawnThisTurn && availableActions.includes('lama_pass'))
        return { type: 'lama_pass', payload: {} };
      return availableActions.includes('lama_quit')
        ? { type: 'lama_quit', payload: {} }
        : null;
    },
  },
});
