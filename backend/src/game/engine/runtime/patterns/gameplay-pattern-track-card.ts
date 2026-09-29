import type {
  GameLifecycleHooks,
  TurnLifecycleInput,
  CardValue,
  CardsSchemaDefinition,
  GameEffectInstruction,
  PawnDefinition,
  QuizQuestion,
} from './pattern-capabilities';
import {
  diceKit,
  movement,
  pawns,
  quiz,
  clockwise,
} from './pattern-capabilities';
import { eventTrackTurn, type EventTrackOptions } from './pattern-capabilities';
import { definePattern } from './gameplay-pattern-core';
import { type GamePattern } from '../contracts/pattern-definition';
import { defineAction, defineChoice } from '../actions/action-builders';
import { gameInput } from '../actions/game-input-schema';
import type { GameContext } from '../definitions/game-author-context';
import type { PawnMove } from '../kits/pawn-kit';
import { GameConfigurationError } from '../contracts/game-domain.errors';
import { withAuthoringPath } from '../contracts/authoring-origin';
import { deliveryRaceAction } from './delivery-race-pattern';

export function eventTrackGame<TState extends object, TTile>(
  options: EventTrackOptions<TState, TTile> & {
    actionType?: string;
    spaces?: number;
    overshoot?: Parameters<typeof movement.track>[0]['overshoot'];
  },
): GamePattern<
  TState,
  'movement.track' | 'dice.set',
  | 'race'
  | 'track'
  | 'dice'
  | 'tile-resolution'
  | 'event-deck'
  | 'effect-pipeline'
> {
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

export type RaceGameOptions = {
  trackId?: string;
  spaces: number;
  positionDisplayOffset?: number;
  overshoot?: 'clamp' | 'wrap' | 'bounce' | 'exact';
  finish?: number;
  homeStretch?: { from: number; to?: number };
  landingEffects?: Readonly<Record<number, readonly GameEffectInstruction[]>>;
  diceId?: string;
  diceCount?: number;
  diceSides?: number;
  winOnFinish?: boolean | string;
  delivery?: {
    recipe: string;
    clientDeckId: string;
    clientHandId: string;
    eventDeckId: string;
    destinationAttribute: string;
    blockedPositionAttribute: string;
    positionOffset: number;
    targetScore: number;
    finishReason: string;
    eventNamespace: string;
  };
};

export function raceGame<TState extends object>(
  options: RaceGameOptions,
): GamePattern<
  TState,
  'movement.track' | 'dice.set',
  'race' | 'track' | 'dice'
> {
  const deliveryAction = deliveryRaceAction<TState>(options);
  return definePattern({
    id: `race-game:${options.trackId ?? 'main'}`,
    mechanics: ['race', 'track', 'dice'],
    turn: clockwise(),
    components: [
      movement.track({
        id: options.trackId ?? 'main',
        spaces: options.spaces,
        positionDisplayOffset: options.positionDisplayOffset,
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
    ...(options.delivery && deliveryAction
      ? { actions: { [options.delivery.recipe]: deliveryAction } }
      : {}),
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
}): GamePattern<
  TState,
  'movement.track' | 'dice.set' | 'quiz.bank',
  'race' | 'track' | 'dice' | 'quiz'
> {
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
  play?: {
    recipe: string;
    choiceId: string;
    finishAt: number;
    finishReason: string;
    extraTurnRolls?: readonly number[];
  };
}): GamePattern<
  TState,
  'pawn.set' | 'dice.set',
  'race' | 'pawns' | 'dice' | 'pawn-selection'
> {
  const play = options.play;
  if (play) assertPawnRacePlay(options, play);
  const finishTurn = (ctx: GameContext<TState>, total: number) => {
    if (play?.extraTurnRolls?.includes(total)) ctx.turn.extra();
    ctx.turn.end();
  };
  type Move = PawnMove & { roll: number };
  const applyMove = (
    ctx: GameContext<TState>,
    playerId: number,
    selected: Move,
  ) => {
    if (!play) return;
    ctx.pawns.applyRaceMove(options.pawnSetId, playerId, selected, {
      finishAt: play.finishAt,
      afterMove: () =>
        ctx.events.message('game.pawn.moved', {
          playerId,
          pawnId: selected.pawnId,
          target: selected.to,
        }),
      onFinish: () =>
        ctx.match.finish({
          winners: [playerId],
          reason: play.finishReason,
        }),
    });
  };
  const action = play
    ? defineAction<TState, Record<string, never>>({
        input: gameInput.object({}),
        execute: ({ actor, ctx }) => {
          const diceId = options.diceId ?? 'main';
          const total = ctx.dice.roll(diceId).total;
          ctx.events.message('game.dice.rolled', {
            playerId: actor.id,
            diceId,
            total,
          });
          const moves = ctx.pawns
            .legalMoves(options.pawnSetId, actor.id, total)
            .map((candidate) => ({ ...candidate, roll: total }));
          if (moves.length === 0) {
            ctx.events.message('game.pawn.no-legal-move', {
              playerId: actor.id,
            });
            finishTurn(ctx, total);
          } else if (moves.length === 1) {
            applyMove(ctx, actor.id, moves[0]);
            if (ctx.match.lifecycle() !== 'finished') finishTurn(ctx, total);
          } else {
            const names = new Map(
              ctx.pawns
                .definitions(options.pawnSetId)
                .map((pawn) => [pawn.id, pawn.label ?? pawn.name ?? pawn.id]),
            );
            ctx.choice.one({
              id: play.choiceId,
              player: actor.id,
              options: moves,
              label: (selected) =>
                `${names.get(selected.pawnId)} → ${selected.to}`,
            });
          }
        },
      })
    : null;
  const choice = play
    ? defineChoice<TState, Move>({
        input: gameInput.object({
          pawnId: gameInput.string({ min: 1, max: 128 }),
          from: gameInput.number({ integer: true }),
          to: gameInput.number({ integer: true }),
          distance: gameInput.number({ integer: true }),
          roll: gameInput.number({ integer: true, min: 1 }),
        }),
        resolve: ({ actor, value, ctx }) => {
          const total = ctx.dice.last(options.diceId ?? 'main')?.total;
          if (total == null) return ctx.reject('PAWN_RACE_ROLL_MISSING');
          applyMove(ctx, actor.id, value);
          if (ctx.match.lifecycle() !== 'finished') finishTurn(ctx, total);
        },
      })
    : null;
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
    ...(play && action && choice
      ? {
          actions: { [play.recipe]: action },
          choices: { [play.choiceId]: choice },
        }
      : {}),
  });
}

function assertPawnRacePlay(
  options: Parameters<typeof pawnRace>[0],
  play: NonNullable<Parameters<typeof pawnRace>[0]['play']>,
): void {
  const fail = (field: string, message: string): never => {
    throw withAuthoringPath(new GameConfigurationError(message), field);
  };
  if (play.choiceId.startsWith('engine.'))
    fail('play.choiceId', 'Reserved pawn race choice identifier');
  if (options.spaces == null || play.finishAt >= options.spaces)
    fail('play.finishAt', 'Pawn race finish must be inside its track');
  const minimum = options.diceCount ?? 1;
  const maximum = minimum * (options.diceSides ?? 6);
  for (const [index, total] of (play.extraTurnRolls ?? []).entries())
    if (total < minimum || total > maximum)
      fail(
        `play.extraTurnRolls[${index}]`,
        'Pawn race extra turn roll is unreachable',
      );
}

export function cardGame<TState extends object>(options: {
  /** Canonical cards definition shared by state, hands, discards and zones. */
  schema: CardsSchemaDefinition;
  deckId: string;
  handId: string;
  drawAtTurnStart?:
    number | NonNullable<GameLifecycleHooks<TState>['beforeTurn']>;
}): GamePattern<
  TState,
  'cards.deck' | 'cards.hands' | 'cards.zone',
  'cards' | 'hands' | 'deck-lifecycle'
> {
  const { deckId, handId } = options;
  const components = [...options.schema.components];
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
