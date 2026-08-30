import {
  cards,
  cardGame,
  defineCardsSchema,
  defineConfiguration,
  defineGame,
  defineGameContent,
  gameInput,
  movement,
  type NoGameState,
  roundScoring,
  setupPlayingPhases,
} from '../../../engine/sdk/public-api';
import {
  CAT_PATTES_DECK,
  CAT_PATTES_DEFAULT_ROUNDS,
  CAT_PATTES_GOAL,
} from './content';
import { CAT_PATTES_ACTIONS, playableInputs } from './rules';
import { resetCatPattesRound, scoreCatPattesRound } from './round-rules';
import { CAT_PATTES_EFFECTS } from './effects';

const scoring = roundScoring<NoGameState>({
  score: ({ state, ctx }) => scoreCatPattesRound(state, ctx),
});
const CAT_PATTES_PHASES = setupPlayingPhases<NoGameState>();
const cardSchema = defineCardsSchema({
  decks: {
    'cat-pattes': cards.deck({
      id: 'cat-pattes',
      cards: CAT_PATTES_DECK.map((card) => card.id),
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    players: cards.hands({
      id: 'players',
      deck: 'cat-pattes',
      initial: 6,
      visibility: 'owner',
    }),
  },
});

export default defineGame<NoGameState>()({
  id: 'cat-pattes',
  displayName: 'Cat Pattes !',
  category: 'JeuxDePlateaux',
  subcategory: 'VentsDansants',
  description: 'Course féline jusqu’à 1 000 pattes.',
  players: { min: 2, max: 6 },
  content: defineGameContent('cat-pattes', { cards: CAT_PATTES_DECK }),
  config: defineConfiguration<NoGameState, { roundsToPlay: number }>({
    input: gameInput.object({
      roundsToPlay: gameInput.number({ integer: true, min: 1, max: 20 }),
    }),
    defaults: { roundsToPlay: CAT_PATTES_DEFAULT_ROUNDS },
    phase: CAT_PATTES_PHASES.initialPhase,
    permission: 'owner',
    ui: {
      title: 'Nombre de manches',
      submitLabel: 'Démarrer la course',
    },
    onConfigured: ({ ctx }) => {
      CAT_PATTES_PHASES.transition(ctx, 'playing');
      const firstPlayerId = ctx.players.all()[0]?.id;
      if (firstPlayerId != null) {
        ctx.round.start(firstPlayerId);
        ctx.turn.to(firstPlayerId);
      }
    },
  }),
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'cat-pattes',
      handId: 'players',
    }),
  ],
  components: [
    movement.track({ id: 'cat-pattes', spaces: CAT_PATTES_GOAL + 1 }),
  ],
  shortcuts: [
    { key: 'Space', type: 'action', actionType: 'draw' },
    { key: 'Enter', type: 'action', actionType: 'play_card' },
    { key: 'D', type: 'action', actionType: 'discard_card' },
  ],
  initialPhase: CAT_PATTES_PHASES.initialPhase,
  phases: CAT_PATTES_PHASES.phases,
  lifecycle: {
    ...scoring.lifecycle,
    onRoundStart: ({ state, ctx }) => resetCatPattesRound(state, ctx),
  },
  actions: CAT_PATTES_ACTIONS,
  effects: CAT_PATTES_EFFECTS,
  bot: {
    choose: ({ state, actor, ctx }) => {
      if (ctx.effects.sourcePlayerId() !== actor.id) {
        return { type: 'draw', payload: {} };
      }
      const input = playableInputs(state, actor.id, ctx)[0];
      if (input) return { type: 'play_card', payload: { ...input } };
      const cardId = ctx.cards.hand<string>('players', actor.id)[0];
      return {
        type: 'discard_card',
        payload: cardId ? { cardId } : {},
      };
    },
  },
});
