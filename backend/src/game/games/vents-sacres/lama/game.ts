import {
  cards,
  cardGame,
  defineCardsSchema,
  defineChoice,
  defineGame,
  defineGameContent,
  gameInput,
  type NoGameState,
  roundScoring,
  when,
} from '../../../engine/sdk/public-api';
import { LAMA_MAX_DECK, nextLamaValue, type LamaCard } from './content';
import {
  LAMA_ACTIONS,
  LAMA_PHASES,
  prepareLamaRound,
  resolvePause,
  resolveReturn,
  scoreLamaRound,
  skipInactiveLamaPlayer,
} from './rules';
import { LAMA_CONFIGURATION } from './configuration';

type LamaState = NoGameState;
const scoring = roundScoring<LamaState>({
  score: ({ state, ctx }) => scoreLamaRound(state, ctx),
});
const cardSchema = defineCardsSchema({
  decks: {
    lama: cards.deck({
      id: 'lama',
      cards: LAMA_MAX_DECK,
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    'lama-hands': cards.hands({
      id: 'lama-hands',
      deck: 'lama',
      initial: 0,
      visibility: 'owner',
      ownerVisibility: 'active-round',
    }),
  },
});

export default defineGame<LamaState>()({
  id: 'lama',
  displayName: 'LAMA',
  category: 'JeuxDeCartes',
  subcategory: 'VentsSacres',
  description:
    'Défaussez vos cartes ou quittez la manche pour limiter vos jetons.',
  content: defineGameContent('lama', { cards: LAMA_MAX_DECK }),
  players: { min: 2, max: 6 },
  presentation: {
    score: {
      label: 'Jetons',
      unit: { singular: 'jeton', plural: 'jetons' },
      changeNarration: 'delta-and-total',
    },
  },
  shortcuts: [
    { key: 'Space', type: 'action', actionType: 'draw', label: 'Piocher' },
    { key: 'S', type: 'interface', id: 'score', label: 'Jetons' },
    {
      key: 'C',
      type: 'interface',
      id: 'discard',
      label: 'Carte au-dessus',
    },
  ],
  config: LAMA_CONFIGURATION,
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'lama',
      handId: 'lama-hands',
    }),
  ],
  initialization: { scores: 0, startRound: false },
  initialPhase: LAMA_PHASES.initialPhase,
  phases: LAMA_PHASES.phases,
  lifecycle: {
    ...scoring.lifecycle,
    onRoundStart: ({ state, ctx }) => prepareLamaRound(state, ctx),
  },
  actions: LAMA_ACTIONS,
  choices: {
    'lama.return': defineChoice<LamaState, number>({
      input: gameInput.number({ integer: true, min: 0, max: 10 }),
      resolve: ({ state, value, ctx }) => resolveReturn(state, value, ctx),
    }),
    'lama.pause': defineChoice<LamaState, string>({
      input: gameInput.literal('continue'),
      resolve: ({ state, ctx }) => resolvePause(state, ctx),
    }),
  },
  automatic: [
    when(
      'skip-inactive-lama-player',
      ({ state: _state, ctx }) => {
        const currentId = ctx.players.current()?.id ?? 0;
        return (
          LAMA_PHASES.is(ctx, 'turn') &&
          !ctx.round.activePlayers().some((player) => player.id === currentId)
        );
      },
      ({ state, ctx }) => skipInactiveLamaPlayer(state, ctx),
    ),
  ],
  bot: {
    choose: ({ state: _state, actor, availableActions, ctx }) => {
      if (availableActions.includes('lama_play')) {
        const discard = ctx.cards.discardPile<LamaCard>('lama');
        const top = discard.at(-1);
        const playable = ctx.cards
          .hand<LamaCard>('lama-hands', actor.id)
          .find(
            (card) =>
              top != null && (card === top || card === nextLamaValue(top)),
          );
        if (playable != null)
          return { type: 'lama_play', payload: { value: playable } };
      }
      if (availableActions.includes('draw'))
        return { type: 'draw', payload: {} };
      if (
        ctx.turn.flags.get<boolean>('lama.drawn') &&
        availableActions.includes('lama_pass')
      )
        return { type: 'lama_pass', payload: {} };
      return availableActions.includes('lama_quit')
        ? { type: 'lama_quit', payload: {} }
        : null;
    },
  },
});
