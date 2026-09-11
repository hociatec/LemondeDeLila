import type {
  NoGameState as AbsurdissimesState,
  GameContext,
} from '../../../engine/sdk/public-api';
import {
  ABSURDISSIMES_ANSWERS,
  ABSURDISSIMES_JUDGE,
  drawWhiteCard,
} from './rules';
export const setupGame = ({
  players,
  ctx,
}: {
  ctx: GameContext<AbsurdissimesState>;
  players: ReturnType<GameContext<AbsurdissimesState>['players']['all']>;
}): AbsurdissimesState => {
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
};
