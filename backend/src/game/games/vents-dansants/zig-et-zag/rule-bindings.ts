import type { GameRuleBindings } from '../../../engine/sdk/public-api';
import { zigRoundPlays } from './rules';
import type { ZigEtZagRoundSummary, ZigEtZagState } from './state';
export type ZigEtZagBattleLogEntry = {
  key: 'zig.battle.started' | 'zig.battle.continues';
  params: { roundNumber: number };
};
export type ZigEtZagPlayerView = {
  lastRound:
    (ZigEtZagRoundSummary & { battleLog: ZigEtZagBattleLogEntry[] }) | null;
};
export const GAME_RULES = {
  viewExtension: ({ state, ctx }): ZigEtZagPlayerView => {
    const summary = state.lastRound;
    const lastRound = summary
      ? {
          roundNumber: summary.roundNumber,
          roundWinnerPlayerId: summary.roundWinnerPlayerId,
          cardsWon: summary.cardsWon,
          plays: zigRoundPlays({
            plays: summary.plays,
            tiedPlayers: [],
          }),
          battleLog: ctx.events
            .messages()
            .flatMap((entry): ZigEtZagBattleLogEntry[] => {
              if (
                (entry.key !== 'zig.battle.started' &&
                  entry.key !== 'zig.battle.continues') ||
                entry.params.roundNumber !== summary.roundNumber
              ) {
                return [];
              }
              return [
                {
                  key: entry.key,
                  params: { roundNumber: summary.roundNumber },
                },
              ];
            }),
        }
      : null;
    return { lastRound };
  },
} satisfies GameRuleBindings<ZigEtZagState, ZigEtZagPlayerView>;
