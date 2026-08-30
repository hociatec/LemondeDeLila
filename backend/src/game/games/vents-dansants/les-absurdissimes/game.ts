import {
  cards,
  cardGame,
  defineCardsSchema,
  defineGame,
  defineGameContent,
} from '../../../engine/sdk/public-api';
import { BLACK_CARDS, WHITE_CARDS } from './content';
import type { AbsurdissimesCard } from './content';
import {
  ABSURDISSIMES_ACTIONS,
  ABSURDISSIMES_ANSWERS,
  ABSURDISSIMES_JUDGE,
  ABSURDISSIMES_PHASES,
  SUBMISSIONS_REVEALED,
  drawWhiteCard,
} from './rules';
import type { NoGameState as AbsurdissimesState } from '../../../engine/sdk/public-api';

const cardSchema = defineCardsSchema({
  decks: {
    white: cards.deck({ id: 'white', cards: WHITE_CARDS, shuffle: true }),
    black: cards.deck({
      id: 'black',
      cards: BLACK_CARDS,
      shuffle: true,
      empty: 'recycle',
    }),
  },
  hands: {
    answers: cards.hands({
      id: 'answers',
      deck: 'black',
      initial: 10,
      visibility: 'owner',
    }),
  },
});
export default defineGame<AbsurdissimesState>()({
  id: 'les-absurdissimes',
  displayName: 'Les Absurdissimes !',
  category: 'Cartes',
  subcategory: 'VentsDansants',
  description: 'Proposez la réponse la plus absurde et convainquez le juge.',
  players: { min: 3, max: 8 },
  events: [SUBMISSIONS_REVEALED],
  content: defineGameContent('les-absurdissimes', {
    blackCards: BLACK_CARDS,
    whiteCards: WHITE_CARDS,
  }),
  patterns: [
    cardGame({
      schema: cardSchema,
      deckId: 'black',
      handId: 'answers',
    }),
  ],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'J', type: 'action', actionType: 'judge_pick' },
  ],
  setup: ({ players, ctx }) => {
    const playerIds = players.map((player) => player.id);
    const judge = ctx.submissionFlow.startJudge(ABSURDISSIMES_JUDGE, {
      players: playerIds,
    });
    const { participantPlayerIds: remainingPlayers } =
      ctx.submissionFlow.openForJudge({
        submissionId: ABSURDISSIMES_ANSWERS,
        judgeId: ABSURDISSIMES_JUDGE,
        players: playerIds,
        secret: true,
      });
    ctx.round.start(judge, remainingPlayers);
    ctx.turn.to(remainingPlayers[0] ?? judge);
    drawWhiteCard(ctx);
    return {};
  },
  initialPhase: ABSURDISSIMES_PHASES.initialPhase,
  phases: ABSURDISSIMES_PHASES.phases,
  actions: ABSURDISSIMES_ACTIONS,
  bot: {
    choose: ({ actor, ctx }) => {
      if (ABSURDISSIMES_PHASES.is(ctx, 'judge')) {
        const winnerId = ctx.random.pick(
          Object.keys(ctx.submissions.values(ABSURDISSIMES_ANSWERS)).map(
            Number,
          ),
        );
        return winnerId == null
          ? null
          : { type: 'judge_pick', payload: { winnerId } };
      }
      const cardId = ctx.random.pick(
        ctx.cards.hand<AbsurdissimesCard>('answers', actor.id),
      )?.id;
      return cardId == null ? null : { type: 'play_card', payload: { cardId } };
    },
  },
});
