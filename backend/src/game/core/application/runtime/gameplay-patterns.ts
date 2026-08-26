import type { PlayerStateEntity } from '../models/game-state.model';
import { cards, type DeckDefinition, type HandsDefinition } from './cards-kit';
import { diceKit } from './dice-kit';
import type {
  GameComponentDefinition,
} from './component-kit';
import type {
  GameLifecycleHooks,
  RoundLifecycleInput,
  TurnLifecycleInput,
} from './game-lifecycle-hooks';
import { movement } from './movement-kit';
import type { GameEffectInstruction } from './effects-kit';
import { pawns, type PawnDefinition } from './pawn-kit';
import { quiz, type QuizQuestion } from './quiz-kit';
import { clockwise, simultaneous, type TurnPolicy } from './turn-kit';
import type { VictoryRule } from './game-definition';

export type GamePattern<TState extends object> = {
  readonly id: string;
  readonly mechanics: readonly string[];
  readonly components?: readonly GameComponentDefinition[];
  readonly lifecycle?: GameLifecycleHooks<TState>;
  readonly turn?: TurnPolicy;
  readonly victory?: VictoryRule<TState>;
};

export function definePattern<TState extends object>(
  pattern: GamePattern<TState>,
): GamePattern<TState> {
  return Object.freeze({
    ...pattern,
    mechanics: Object.freeze([...pattern.mechanics]),
    components: Object.freeze([...(pattern.components ?? [])]),
  });
}

export function composePatterns<TState extends object>(
  ...patterns: readonly GamePattern<TState>[]
): Omit<GamePattern<TState>, 'id'> & { ids: string[] } {
  return {
    ids: patterns.map((pattern) => pattern.id),
    mechanics: [...new Set(patterns.flatMap((pattern) => pattern.mechanics))],
    components: patterns.flatMap((pattern) => pattern.components ?? []),
    lifecycle: composeLifecycle(
      patterns.flatMap((pattern) =>
        pattern.lifecycle ? [pattern.lifecycle] : [],
      ),
    ),
    turn: patterns.reduce<TurnPolicy | undefined>(
      (selected, pattern) => pattern.turn ?? selected,
      undefined,
    ),
    victory: composeVictory(
      patterns.flatMap((pattern) =>
        pattern.victory ? [pattern.victory] : [],
      ),
    ),
  };
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
    id: 'race-game',
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
    id: 'quiz-race',
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
  diceId?: string;
  diceCount?: number;
  diceSides?: number;
}): GamePattern<TState> {
  return definePattern({
    id: 'pawn-race',
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
    | number
    | NonNullable<GameLifecycleHooks<TState>['beforeTurn']>;
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
            count: options.drawAtTurnStart as number,
          })
        : undefined;
  return definePattern({
    id: 'card-game',
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
  afterAttempt?: (input: TurnLifecycleInput<TState> & {
    drawn: readonly TCard[];
  }) => void;
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

export function simultaneousAnswers<TState extends object>(): GamePattern<TState> {
  return definePattern({
    id: 'simultaneous-answers',
    mechanics: ['simultaneous', 'secret-submissions', 'reveal'],
    turn: simultaneous(),
  });
}

export function roundScoring<TState extends object>(options: {
  score: (input: RoundLifecycleInput<TState>) => void;
}): GamePattern<TState> {
  return definePattern({
    id: 'round-scoring',
    mechanics: ['rounds', 'scoring', 'starter-rotation'],
    lifecycle: { onRoundEnd: options.score },
  });
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
  hooks: ReadonlyArray<
    GameLifecycleHooks<TState>['beforeTurn'] | undefined
  >,
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
  hooks: ReadonlyArray<
    GameLifecycleHooks<TState>['onRoundStart'] | undefined
  >,
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
