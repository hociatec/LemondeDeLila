import { victoryWhen } from './automatic-kit';
import type { VictoryRule } from './game-definition';

export function scoreVictory<TState extends object>(options: {
  target: number;
  scores: (state: TState) => Readonly<Record<number, number>>;
}): VictoryRule<TState> {
  return victoryWhen(({ state }) => {
    const winners = Object.entries(options.scores(state))
      .filter(([, score]) => score >= options.target)
      .map(([playerId]) => Number(playerId));
    return winners.length > 0
      ? { winnerPlayerIds: winners, reason: 'score-target' }
      : null;
  });
}

export function collectionVictory<TState extends object>(options: {
  target: number;
  count: (state: TState, playerId: number) => number;
}): VictoryRule<TState> {
  return victoryWhen(({ state, ctx }) => {
    const winners = ctx.players
      .all()
      .filter((player) => options.count(state, player.id) >= options.target)
      .map((player) => player.id);
    return winners.length > 0
      ? { winnerPlayerIds: winners, reason: 'collection-target' }
      : null;
  });
}
