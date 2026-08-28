import type { PlayerStateEntity } from '../models/game-state.model';
import { cards, type DeckDefinition, type HandsDefinition } from './cards-kit';
import { diceKit } from './dice-kit';
import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import type {
  GameLifecycleHooks,
  RoundLifecycleInput,
  TurnLifecycleInput,
} from './game-lifecycle-hooks';
import type { GameContext } from './game-rule-context';
import { movement } from './movement-kit';
import type { GameEffectInstruction } from './effects-kit';
import { pawns, type PawnDefinition } from './pawn-kit';
import { quiz, type QuizQuestion } from './quiz-kit';
import { clockwise, simultaneous, type TurnPolicy } from './turn-kit';
import type { VictoryRule } from './game-definition';
import type { GameActionMap } from './game-definition';
import { grid } from './grid-kit';
import { economy } from './economy-kit';
import { inventory } from './inventory-kit';
import {
  completeRound,
  eventTrackTurn,
  type EventTrackOptions,
} from './gameplay-recipes';
import { GameConfigurationError } from '../../domain/errors/game-domain.errors';

export type GamePattern<TState extends object> = {
  readonly id: string;
  readonly mechanics: readonly string[];
  readonly components?: readonly GameComponentDefinition[];
  readonly lifecycle?: GameLifecycleHooks<TState>;
  readonly initialization?: GameInitialization;
  readonly turn?: TurnPolicy;
  readonly victory?: VictoryRule<TState>;
  readonly actions?: GameActionMap<TState>;
};

export function definePattern<TState extends object>(
  pattern: GamePattern<TState>,
): GamePattern<TState> {
  return Object.freeze({
    ...pattern,
    mechanics: Object.freeze([...pattern.mechanics]),
    components: Object.freeze([...(pattern.components ?? [])]),
    actions: Object.freeze({ ...(pattern.actions ?? {}) }),
  });
}

export function composePatterns<TState extends object>(
  ...patterns: readonly GamePattern<TState>[]
): Omit<GamePattern<TState>, 'id'> & { ids: string[] } {
  assertComposablePatterns(patterns);
  return {
    ids: patterns.map((pattern) => pattern.id),
    mechanics: [...new Set(patterns.flatMap((pattern) => pattern.mechanics))],
    components: patterns.flatMap((pattern) => pattern.components ?? []),
    actions: patterns.reduce<GameActionMap<TState>>(
      (merged, pattern) => ({
        ...merged,
        ...(pattern.actions ?? {}),
      }),
      {},
    ),
    lifecycle: composeLifecycle(
      patterns.flatMap((pattern) =>
        pattern.lifecycle ? [pattern.lifecycle] : [],
      ),
    ),
    initialization: composeInitialization(
      patterns.map((pattern) => pattern.initialization),
    ),
    turn: patterns.reduce<TurnPolicy | undefined>(
      (selected, pattern) => pattern.turn ?? selected,
      undefined,
    ),
    victory: composeVictory(
      patterns.flatMap((pattern) => (pattern.victory ? [pattern.victory] : [])),
    ),
  };
}

export function eventTrackGame<TState extends object, TTile>(
  options: EventTrackOptions<TState, TTile> & {
    actionType?: string;
    spaces?: number;
    overshoot?: Parameters<typeof movement.track>[0]['overshoot'];
  },
): GamePattern<TState> {
  const actionType = options.actionType ?? 'roll';
  return definePattern({
    id: `event-track-game:${options.trackId}:${actionType}`,
    mechanics: [
      'race',
      'track',
      'dice',
      'tile-resolution',
      'event-deck',
      'effect-pipeline',
    ],
    turn: clockwise(),
    components: [
      diceKit({
        id: options.diceId ?? 'main',
        count: 1,
        sides: 6,
      }),
      movement.track({
        id: options.trackId,
        spaces: options.spaces ?? options.tiles.length,
        overshoot: options.overshoot ?? 'clamp',
      }),
    ],
    actions: {
      [actionType]: eventTrackTurn(options),
    },
  });
}

export function raceGame<TState extends object>(options: {
  trackId?: string;
  spaces: number;
  overshoot?: 'clamp' | 'wrap' | 'bounce' | 'exact';
  finish?: number;
  homeStretch?: { from: number; to?: number };
  landingEffects?: Readonly<Record<number, readonly GameEffectInstruction[]>>;
  diceId?: string;
  diceCount?: number;
  diceSides?: number;
  winOnFinish?: boolean | string;
}): GamePattern<TState> {
  return definePattern({
    id: `race-game:${options.trackId ?? 'main'}`,
    mechanics: ['race', 'track', 'dice'],
    turn: clockwise(),
    components: [
      movement.track({
        id: options.trackId ?? 'main',
        spaces: options.spaces,
        overshoot: options.overshoot ?? 'clamp',
        finish: options.finish,
        homeStretch: options.homeStretch,
        landingEffects: options.landingEffects,
      }),
      diceKit({
        id: options.diceId ?? 'main',
        count: options.diceCount ?? 1,
        sides: options.diceSides ?? 6,
      }),
    ],
    ...(options.winOnFinish
      ? {
          victory: {
            evaluate: ({ ctx }) => {
              const winner = ctx.players
                .active()
                .find((player) =>
                  ctx.movement.atFinish(options.trackId ?? 'main', player.id),
                );
              return winner
                ? {
                    winnerPlayerIds: [winner.id],
                    reason:
                      typeof options.winOnFinish === 'string'
                        ? options.winOnFinish
                        : 'track-finished',
                  }
                : null;
            },
          },
        }
      : {}),
  });
}

export function quizRace<TState extends object>(options: {
  trackId?: string;
  spaces: number;
  overshoot?: 'clamp' | 'wrap' | 'bounce' | 'exact';
  finish?: number;
  landingEffects?: Readonly<Record<number, readonly GameEffectInstruction[]>>;
  diceId?: string;
  diceCount?: number;
  diceSides?: number;
  winOnFinish?: boolean | string;
  quizId: string;
  questions: readonly QuizQuestion[];
  shuffleQuestions?: boolean;
}): GamePattern<TState> {
  const race = raceGame<TState>(options);
  return definePattern({
    ...race,
    id: `quiz-race:${options.trackId ?? 'main'}:${options.quizId}`,
    mechanics: [...race.mechanics, 'quiz'],
    components: [
      ...(race.components ?? []),
      quiz.bank({
        id: options.quizId,
        questions: options.questions,
        shuffle: options.shuffleQuestions ?? true,
      }),
    ],
  });
}

export function pawnRace<TState extends object>(options: {
  pawnSetId: string;
  pawns: readonly PawnDefinition[];
  perPlayer?: number;
  spaces?: number;
  overshoot?: 'clamp' | 'wrap' | 'bounce' | 'exact';
  initialPosition?: number;
  entryRoll?: number;
  entryPosition?: number;
  exactFinish?: boolean;
  homeStretchFrom?: number;
  diceId?: string;
  diceCount?: number;
  diceSides?: number;
}): GamePattern<TState> {
  return definePattern({
    id: `pawn-race:${options.pawnSetId}`,
    mechanics: ['race', 'pawns', 'dice', 'pawn-selection'],
    turn: clockwise(),
    components: [
      diceKit({
        id: options.diceId ?? 'main',
        count: options.diceCount ?? 1,
        sides: options.diceSides ?? 6,
      }),
      pawns.set({
        id: options.pawnSetId,
        pawns: options.pawns,
        perPlayer: options.perPlayer,
        spaces: options.spaces,
        overshoot: options.overshoot,
        initialPosition: options.initialPosition,
        entryRoll: options.entryRoll,
        entryPosition: options.entryPosition,
        exactFinish: options.exactFinish,
        homeStretchFrom: options.homeStretchFrom,
      }),
    ],
  });
}

export function cardGame<TState extends object, TCard>(options: {
  deckId?: string;
  handId?: string;
  cards: readonly TCard[];
  initialHandSize?: number;
  drawAtTurnStart?:
    number | NonNullable<GameLifecycleHooks<TState>['beforeTurn']>;
  visibility?: HandsDefinition['visibility'];
  shuffle?: boolean;
  empty?: DeckDefinition<TCard>['empty'];
}): GamePattern<TState> {
  const deckId = options.deckId ?? 'main';
  const handId = options.handId ?? 'players';
  const components: Array<DeckDefinition<TCard> | HandsDefinition> = [
    cards.deck({
      id: deckId,
      cards: options.cards,
      shuffle: options.shuffle ?? true,
      empty: options.empty ?? 'recycle',
    }),
    cards.hands({
      id: handId,
      deck: deckId,
      initial: options.initialHandSize ?? 0,
      visibility: options.visibility ?? 'owner',
    }),
  ];
  const beforeTurn =
    typeof options.drawAtTurnStart === 'function'
      ? options.drawAtTurnStart
      : (options.drawAtTurnStart ?? 0) > 0
        ? drawCardsAtTurnStart<TState, TCard>({
            deckId,
            handId,
            count: options.drawAtTurnStart,
          })
        : undefined;
  return definePattern({
    id: `card-game:${deckId}:${handId}`,
    mechanics: ['cards', 'hands', 'deck-lifecycle'],
    components,
    turn: clockwise(),
    ...(beforeTurn ? { lifecycle: { beforeTurn } } : {}),
  });
}

export function drawCardsAtTurnStart<TState extends object, TCard>(options: {
  deckId: string;
  handId: string;
  count?: number;
  recycle?: boolean;
  when?: (input: TurnLifecycleInput<TState>) => boolean;
  afterDraw?: (input: TurnLifecycleInput<TState> & { card: TCard }) => void;
  afterAttempt?: (
    input: TurnLifecycleInput<TState> & {
      drawn: readonly TCard[];
    },
  ) => void;
}): NonNullable<GameLifecycleHooks<TState>['beforeTurn']> {
  return (input) => {
    if (!input.player || (options.when && !options.when(input))) return;
    const drawn = input.ctx.cards.drawManyToHand<TCard>(
      options.deckId,
      options.handId,
      input.player.id,
      options.count ?? 1,
      { recycle: options.recycle },
    );
    const last = drawn.at(-1);
    input.ctx.effects.recordSource({
      playerId: input.player.id,
      deckId: options.deckId,
      ...(last != null && typeof last === 'object' && 'id' in last
        ? {
            cardId: (last as { id: string | number }).id,
          }
        : typeof last === 'string' || typeof last === 'number'
          ? { cardId: last }
          : {}),
    });
    for (const card of drawn) options.afterDraw?.({ ...input, card });
    options.afterAttempt?.({ ...input, drawn });
  };
}

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

function assertComposablePatterns<TState extends object>(
  patterns: readonly GamePattern<TState>[],
): void {
  const seenPatternIds = new Set<string>();
  const seenComponentKeys = new Set<string>();
  const seenActionKeys = new Set<string>();
  const initializedResources = new Map<string, string>();
  const initializedCounters = new Map<string, string>();
  const initializedTracks = new Map<string, string>();
  const initializedPawns = new Map<string, string>();
  let selectedTurn: { id: string; policy: TurnPolicy } | null = null;
  for (const pattern of patterns) {
    if (seenPatternIds.has(pattern.id)) {
      throw new GameConfigurationError(
        `Composition de patterns invalide: pattern dupliqué « ${pattern.id} »`,
      );
    }
    seenPatternIds.add(pattern.id);

    for (const component of pattern.components ?? []) {
      const id = 'id' in component ? component.id : undefined;
      const key = `${component.component}:${String(id)}`;
      if (seenComponentKeys.has(key)) {
        throw new GameConfigurationError(
          `Composition de patterns invalide: composant dupliqué « ${key} »`,
        );
      }
      seenComponentKeys.add(key);
    }

    for (const actionId of Object.keys(pattern.actions ?? {})) {
      if (seenActionKeys.has(actionId)) {
        throw new GameConfigurationError(
          `Composition de patterns invalide: action dupliquée « ${actionId} »`,
        );
      }
      seenActionKeys.add(actionId);
    }

    assertInitializationKeys(
      pattern.initialization?.resources,
      initializedResources,
      pattern.id,
      'resource',
    );
    assertInitializationKeys(
      pattern.initialization?.counters,
      initializedCounters,
      pattern.id,
      'counter',
    );
    assertInitializationKeys(
      pattern.initialization?.tracks,
      initializedTracks,
      pattern.id,
      'track',
    );
    for (const [index, pawn] of (
      pattern.initialization?.pawns ?? []
    ).entries()) {
      const key = `${pawn.setId}:${index}`;
      const previous = initializedPawns.get(key);
      if (previous) {
        throw new GameConfigurationError(
          `Composition de patterns invalide: initialisation de pion dupliquée « ${key} » par « ${previous} » et « ${pattern.id} »`,
        );
      }
      initializedPawns.set(key, pattern.id);
    }

    if (!pattern.turn) continue;
    if (!selectedTurn) {
      selectedTurn = { id: pattern.id, policy: pattern.turn };
      continue;
    }
    if (sameTurnPolicy(selectedTurn.policy, pattern.turn)) continue;
    throw new GameConfigurationError(
      `Composition de patterns invalide: politiques de tour incompatibles « ${selectedTurn.id} » et « ${pattern.id} »`,
    );
  }
}

function assertInitializationKeys<TValue>(
  values: Readonly<Record<string, TValue>> | undefined,
  seen: Map<string, string>,
  patternId: string,
  kind: string,
): void {
  for (const key of Object.keys(values ?? {})) {
    const previous = seen.get(key);
    if (previous) {
      throw new GameConfigurationError(
        `Composition de patterns invalide: initialisation ${kind} dupliquée « ${key} » par « ${previous} » et « ${patternId} »`,
      );
    }
    seen.set(key, patternId);
  }
}

function sameTurnPolicy(left: TurnPolicy, right: TurnPolicy): boolean {
  return (
    left.kind === right.kind &&
    (left.actionPoints ?? null) === (right.actionPoints ?? null)
  );
}

function composeInitialization(
  initializations: ReadonlyArray<GameInitialization | undefined>,
): GameInitialization | undefined {
  const active = initializations.filter(Boolean) as GameInitialization[];
  if (active.length === 0) return undefined;
  return active.reduce<GameInitialization>(
    (result, value) => ({
      ...result,
      ...value,
      scores: value.scores ?? result.scores,
      resources: { ...result.resources, ...value.resources },
      counters: { ...result.counters, ...value.counters },
      tracks: { ...result.tracks, ...value.tracks },
      pawns: [...(result.pawns ?? []), ...(value.pawns ?? [])],
    }),
    {},
  );
}

function composeLifecycle<TState extends object>(
  hooks: readonly GameLifecycleHooks<TState>[],
): GameLifecycleHooks<TState> | undefined {
  if (hooks.length === 0) return undefined;
  return {
    beforeTurn: composeTurnHooks(hooks.map((hook) => hook.beforeTurn)),
    afterTurn: composeTurnHooks(hooks.map((hook) => hook.afterTurn)),
    onRoundStart: composeRoundHooks(hooks.map((hook) => hook.onRoundStart)),
    onRoundEnd: composeRoundHooks(hooks.map((hook) => hook.onRoundEnd)),
  };
}

function composeTurnHooks<TState extends object>(
  hooks: ReadonlyArray<GameLifecycleHooks<TState>['beforeTurn'] | undefined>,
): GameLifecycleHooks<TState>['beforeTurn'] {
  const active = hooks.filter(Boolean) as Array<
    NonNullable<GameLifecycleHooks<TState>['beforeTurn']>
  >;
  if (active.length === 0) return undefined;
  return (input: TurnLifecycleInput<TState>) => {
    for (const hook of active) hook(input);
  };
}

function composeRoundHooks<TState extends object>(
  hooks: ReadonlyArray<GameLifecycleHooks<TState>['onRoundStart'] | undefined>,
): GameLifecycleHooks<TState>['onRoundStart'] {
  const active = hooks.filter(Boolean) as Array<
    NonNullable<GameLifecycleHooks<TState>['onRoundStart']>
  >;
  if (active.length === 0) return undefined;
  return (input: RoundLifecycleInput<TState>) => {
    for (const hook of active) hook(input);
  };
}

function composeVictory<TState extends object>(
  rules: readonly VictoryRule<TState>[],
): VictoryRule<TState> | undefined {
  if (rules.length === 0) return undefined;
  return {
    evaluate: (input) => {
      for (const rule of rules) {
        const result = rule.evaluate(input);
        if (result) return result;
      }
      return null;
    },
  };
}
