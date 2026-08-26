import {
  cards,
  cardGame,
  defineGame,
  playerView,
} from '../../../core/application/public-api';
import { BLACK_CARDS, WHITE_CARDS } from './content';
import type { AbsurdissimesCard } from './content';
import {
  ABSURDISSIMES_ACTIONS,
  ABSURDISSIMES_ANSWERS,
  ABSURDISSIMES_JUDGE,
  ABSURDISSIMES_PHASES,
  ABSURDISSIMES_TARGET_SCORE,
  currentWhiteCard,
  drawWhiteCard,
} from './rules';
import type { AbsurdissimesPlayerView, AbsurdissimesState } from './state';

const whiteDeck = cards.deck({
  id: 'white',
  cards: WHITE_CARDS,
  shuffle: true,
});
export default defineGame<
  AbsurdissimesState,
  typeof ABSURDISSIMES_ACTIONS,
  AbsurdissimesPlayerView
>({
  id: 'les-absurdissimes',
  displayName: 'Les Absurdissimes !',
  category: 'Cartes',
  subcategory: 'VentsDansants',
  description: 'Proposez la réponse la plus absurde et convainquez le juge.',
  players: { min: 3, max: 8 },
  patterns: [
    cardGame({
      deckId: 'black',
      handId: 'answers',
      cards: BLACK_CARDS,
      initialHandSize: 10,
    }),
  ],
  components: [whiteDeck],
  shortcuts: [
    { key: 'C', type: 'action', actionType: 'play_card' },
    { key: 'J', type: 'action', actionType: 'judge_pick' },
  ],
  setup: ({ players, ctx }) => {
    const playerIds = players.map((player) => player.id);
    const judge = ctx.judge.start(ABSURDISSIMES_JUDGE, {
      players: playerIds,
    });
    const remainingPlayers = playerIds.filter((playerId) => playerId !== judge);
    ctx.submissions.open({
      id: ABSURDISSIMES_ANSWERS,
      players: remainingPlayers,
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
  view: ({ state, ctx }) => {
    const roundStage = ABSURDISSIMES_PHASES.current(ctx);
    const currentWhite = currentWhiteCard(ctx);
    return playerView({
      game: {
        currentWhite,
        roundStage,
        targetScore: ABSURDISSIMES_TARGET_SCORE,
        scores: Object.fromEntries(
          ctx.players.all().map((player) => [player.id, ctx.score.get(player.id)]),
        ),
        remainingPlayers: ctx.round
          .activePlayers()
          .map((player) => player.id),
        winnerId: ctx.match.result()?.winnerPlayerIds[0] ?? null,
      },
      extras: {
        stage: roundStage,
        currentWhite,
        judgeId: ctx.judge.current(ABSURDISSIMES_JUDGE),
        remainingPlayers: ctx.round
          .activePlayers()
          .map((player) => player.id),
        scores: Object.fromEntries(
          ctx.players.all().map((player) => [player.id, ctx.score.get(player.id)]),
        ),
        targetScore: ABSURDISSIMES_TARGET_SCORE,
      },
    });
  },
  bot: {
    choose: ({ actor, ctx }) => {
      if (ABSURDISSIMES_PHASES.is(ctx, 'judge')) {
        const winnerId = ctx.random.pick(
          Object.keys(
            ctx.submissions.values(ABSURDISSIMES_ANSWERS),
          ).map(Number),
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
