import type { PlayerStateEntity } from '../../models/game-state.model';
import type { GameContext } from '../game-rule-context';
import type { RoundLifecycleInput } from '../lifecycle/game-lifecycle-hooks';
import { clockwise, simultaneous } from '../kits/turn-kit';
import { grid } from '../kits/grid-kit';
import { economy } from '../kits/economy-kit';
import { inventory } from '../kits/inventory-kit';
import { completeRound } from '../recipes/gameplay-recipes';
import { definePattern, type GamePattern } from './gameplay-pattern-core';

export function collectionGame<TState extends object>(options: {
  completedSets: (input: {
    state: TState;
    player: PlayerStateEntity;
  }) => number;
  targetSets: number;
}): GamePattern<TState> {
  return definePattern({
    id: 'collection-game',
    mechanics: ['collections', 'sets', 'scoring'],
    victory: {
      evaluate: ({ state, ctx }) => {
        const winners = ctx.players
          .active()
          .filter(
            (player) =>
              options.completedSets({ state, player }) >= options.targetSets,
          )
          .map((player) => player.id);
        return winners.length > 0
          ? { winnerPlayerIds: winners, reason: 'sets-completed' }
          : null;
      },
    },
  });
}

export function pushYourLuck<TState extends object>(): GamePattern<TState> {
  return definePattern({
    id: 'push-your-luck',
    mechanics: ['push-your-luck', 'pass', 'round-risk'],
  });
}

export function simultaneousAnswers<
  TState extends object,
>(): GamePattern<TState> {
  return definePattern({
    id: 'simultaneous-answers',
    mechanics: ['simultaneous', 'secret-submissions', 'reveal'],
    turn: simultaneous(),
  });
}

export function roundScoring<TState extends object>(options: {
  score: (input: RoundLifecycleInput<TState>) => void;
  reset?: (input: RoundLifecycleInput<TState>) => void;
  winner?: (input: RoundLifecycleInput<TState>) => number | number[] | null;
  endWhen?: (input: RoundLifecycleInput<TState>) => boolean;
  matchEndWhen?: (input: RoundLifecycleInput<TState>) => boolean;
  rotateStarter?: boolean;
  resetScope?: 'round' | 'match';
  nextRound?:
    | false
    | 'rotate'
    | { starterPlayerId: number }
    | ((input: RoundLifecycleInput<TState>) => number | null);
  matchReason?: string | ((input: RoundLifecycleInput<TState>) => string);
}): GamePattern<TState> {
  return definePattern({
    id: 'round-scoring:main',
    mechanics: ['rounds', 'scoring', 'starter-rotation'],
    lifecycle: {
      onRoundEnd: ({ state, ctx }) => {
        options.score({ state, roundNumber: ctx.round.number, ctx });
        const winners = normalizeWinners(
          options.winner?.({ state, ctx, roundNumber: ctx.round.number }),
        );
        if (winners.length > 0) ctx.round.winner(...winners);
        if (!options.endWhen?.({ state, ctx, roundNumber: ctx.round.number }))
          return;
        const matchReason =
          typeof options.matchReason === 'function'
            ? options.matchReason({ state, ctx, roundNumber: ctx.round.number })
            : (options.matchReason ?? 'match-end');
        if (
          options.matchEndWhen?.({ state, ctx, roundNumber: ctx.round.number })
        ) {
          ctx.match.finish({
            winners,
            reason: matchReason,
          });
          return;
        }
        const nextRoundOption = options.nextRound;
        const nextRound =
          typeof nextRoundOption === 'function'
            ? ({ state, ctx }: { state: TState; ctx: GameContext<TState> }) =>
                nextRoundOption({
                  state,
                  ctx,
                  roundNumber: ctx.round.number,
                })
            : (nextRoundOption ??
              (options.rotateStarter === false ? false : 'rotate'));
        completeRound(ctx, {
          winnerPlayerIds: winners,
          next: nextRound,
        });
      },
      onRoundStart: options.reset
        ? ({ state, ctx, roundNumber }) => {
            if (options.resetScope === 'match' && roundNumber > 1) return;
            options.reset?.({ state, ctx, roundNumber });
          }
        : undefined,
    },
  });
}

function normalizeWinners(
  winners: number | number[] | null | undefined,
): number[] {
  const selected =
    winners == null ? [] : Array.isArray(winners) ? winners : [winners];
  return [
    ...new Set(selected.filter((winnerId) => Number.isInteger(winnerId))),
  ];
}

export function gridGame<TState extends object>(options: {
  boardId?: string;
  width: number;
  height: number;
  diagonals?: boolean;
  winLength?: number;
  drawWhenFull?: boolean;
  winnerReason?: string;
  drawReason?: string;
}): GamePattern<TState> {
  const boardId = options.boardId ?? 'main';
  return definePattern({
    id: `grid-game:${boardId}`,
    mechanics: ['grid', 'legal-cells', 'grid-victory'],
    turn: clockwise(),
    components: [
      grid.board({
        id: boardId,
        width: options.width,
        height: options.height,
        diagonals: options.diagonals,
      }),
    ],
    ...(options.winLength
      ? {
          victory: {
            evaluate: ({ ctx }) => {
              const winner = ctx.grid.lineWinner<number>(
                boardId,
                options.winLength!,
              );
              if (winner != null) {
                return {
                  winnerPlayerIds: [winner],
                  reason: options.winnerReason ?? 'grid-line',
                };
              }
              return options.drawWhenFull && ctx.grid.full(boardId)
                ? {
                    winnerPlayerIds: [],
                    reason: options.drawReason ?? 'draw',
                  }
                : null;
            },
          },
        }
      : {}),
  });
}

export function marketGame<TState extends object>(options: {
  marketId: string;
  inventoryId: string;
  items: readonly string[];
  currency: string;
  prices: Readonly<Record<string, number>>;
  startingCurrency?: number;
  minPrice?: number;
  maxPrice?: number;
  turnsCounterId?: string;
  maxRounds?: number;
  winnerReason?: string;
}): GamePattern<TState> {
  return definePattern({
    id: `market-game:${options.marketId}:${options.inventoryId}`,
    mechanics: ['market', 'economy', 'buy', 'sell', 'solvency'],
    turn: clockwise(),
    components: [
      inventory.set({
        id: options.inventoryId,
        items: options.items,
        visibility: 'public',
      }),
      economy.market({
        id: options.marketId,
        inventory: options.inventoryId,
        currency: options.currency,
        prices: options.prices,
        minPrice: options.minPrice,
        maxPrice: options.maxPrice,
      }),
    ],
    initialization: {
      resources:
        options.startingCurrency == null
          ? undefined
          : { [options.currency]: options.startingCurrency },
      counters: options.turnsCounterId
        ? { [options.turnsCounterId]: 0 }
        : undefined,
      firstPlayer: 'first',
      startRound: true,
    },
    ...(options.turnsCounterId && options.maxRounds
      ? {
          victory: {
            evaluate: ({ ctx }) => {
              if (
                ctx.counters.get(options.turnsCounterId!) <
                ctx.players.count() * options.maxRounds!
              ) {
                return null;
              }
              return {
                winnerPlayerIds: ctx.ranking.leaders(
                  ctx.players.all().map((player) => player.id),
                  {
                    value: (playerId) =>
                      ctx.economy.netWorth(options.marketId, playerId),
                  },
                ),
                reason: options.winnerReason ?? 'market-closed',
              };
            },
          },
        }
      : {}),
  });
}

export const economyGame = marketGame;

export function submissionJudgeGame<TState extends object>(
  options: {
    submissionId?: string;
    voteId?: string;
    judgeId?: string;
    secret?: boolean;
    openSubmissionOnRoundStart?: boolean;
    rotateJudgeOnRoundEnd?: boolean;
    targetScore?: number;
    winnerReason?: string;
  } = {},
): GamePattern<TState> {
  return definePattern({
    id: `submission-judge-game:${options.submissionId ?? 'main'}:${options.judgeId ?? 'judge'}`,
    mechanics: [
      'simultaneous',
      'secret-submissions',
      'reveal',
      'judge',
      'voting',
      'scoring',
    ],
    turn: simultaneous(),
    lifecycle: {
      onRoundStart: ({ ctx }) => {
        if (options.judgeId && !ctx.judge.has(options.judgeId)) {
          ctx.submissionFlow.startJudge(options.judgeId, {
            starterPlayerId: ctx.round.starter() ?? undefined,
          });
        }
        if (options.openSubmissionOnRoundStart && options.submissionId) {
          ctx.submissionFlow.open({
            id: options.submissionId,
            secret: options.secret ?? true,
            waitForAll: true,
          });
        }
      },
      onRoundEnd: ({ ctx }) => {
        if (
          options.rotateJudgeOnRoundEnd &&
          options.judgeId &&
          ctx.judge.has(options.judgeId)
        ) {
          ctx.submissionFlow.nextJudge(options.judgeId);
        }
      },
    },
    ...(options.targetScore
      ? {
          victory: {
            evaluate: ({ ctx }) => {
              const reached = ctx.players
                .all()
                .filter(
                  (player) => ctx.score.get(player.id) >= options.targetScore!,
                );
              return reached.length === 1
                ? {
                    winnerPlayerIds: [reached[0].id],
                    reason: options.winnerReason ?? 'target-score',
                  }
                : null;
            },
          },
        }
      : {}),
  });
}

export const submissionGame = submissionJudgeGame;
