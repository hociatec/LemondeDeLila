import { type CardValue } from '../cards/cards-kit';
import type { CardsSchemaDefinition } from '../cards/typed-cards';
import type { GameComponentDefinition } from '../definitions/component-kit';
import { diceKit } from '../kits/dice-kit';
import type {
  GameLifecycleHooks,
  TurnLifecycleInput,
} from '../lifecycle/game-lifecycle-hooks';
import { movement } from '../kits/movement-kit';
import type { GameEffectInstruction } from '../effects/effects-kit';
import { pawns, type PawnDefinition } from '../kits/pawn-kit';
import { quiz, type QuizQuestion } from '../kits/quiz-kit';
import { clockwise } from '../kits/turn-kit';
import {
  eventTrackTurn,
  type EventTrackOptions,
} from '../recipes/gameplay-recipes';
import { definePattern, type GamePattern } from './gameplay-pattern-core';

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

export function cardGame<TState extends object>(options: {
  /** Canonical cards definition shared by state, hands, discards and zones. */
  schema: CardsSchemaDefinition;
  deckId: string;
  handId: string;
  drawAtTurnStart?:
    number | NonNullable<GameLifecycleHooks<TState>['beforeTurn']>;
}): GamePattern<TState> {
  const { deckId, handId } = options;
  const components: GameComponentDefinition[] = [...options.schema.components];
  const beforeTurn =
    typeof options.drawAtTurnStart === 'function'
      ? options.drawAtTurnStart
      : (options.drawAtTurnStart ?? 0) > 0
        ? drawCardsAtTurnStart<TState, CardValue>({
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

export function drawCardsAtTurnStart<
  TState extends object,
  TCard extends CardValue,
>(options: {
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
