import type {
  GameActionDefinition,
  GameActionExecution,
} from './game-definition';

export type ActionCondition<TState extends object> = NonNullable<
  GameActionDefinition<TState, object>['available']
>;

export type ActionValidator<
  TState extends object,
  TInput extends object,
> = NonNullable<GameActionDefinition<TState, TInput>['validate']>;

export function allConditions<TState extends object>(
  ...conditions: readonly ActionCondition<TState>[]
): ActionCondition<TState> {
  return (input) => conditions.every((condition) => condition(input));
}

export function anyCondition<TState extends object>(
  ...conditions: readonly ActionCondition<TState>[]
): ActionCondition<TState> {
  return (input) => conditions.some((condition) => condition(input));
}

export function whenTurnOfActor<
  TState extends object,
>(): ActionCondition<TState> {
  return ({ actor, ctx }) => ctx.turn.is(actor.id);
}

export function whenHasCard<TState extends object>(
  handId: string,
  minimum = 1,
): ActionCondition<TState> {
  return ({ actor, ctx }) =>
    ctx.cards.hand(handId, actor.id).length >= Math.max(1, minimum);
}

export function whenPhase<TState extends object>(
  ...phaseIds: readonly string[]
): ActionCondition<TState> {
  return ({ ctx }) => phaseIds.includes(ctx.phase.current());
}

export function whenNoPending<
  TState extends object,
>(): ActionCondition<TState> {
  return ({ ctx }) =>
    ctx.choice.current() == null && !ctx.effects.isResolving();
}

export function whenResourceAtLeast<TState extends object>(
  resourceId: string,
  amount: number,
): ActionCondition<TState> {
  return ({ actor, ctx }) => ctx.resources.has(actor.id, resourceId, amount);
}

export function allValidators<TState extends object, TInput extends object>(
  ...validators: readonly ActionValidator<TState, TInput>[]
): ActionValidator<TState, TInput> {
  return (input) => validators.every((validator) => validator(input));
}

export function ownCard<TState extends object, TInput extends object>(options: {
  handId: string;
  cardId: (input: TInput) => string;
}): ActionValidator<TState, TInput> {
  return ({ actor, input, ctx }) =>
    ctx.cards
      .hand<string>(options.handId, actor.id)
      .includes(options.cardId(input));
}

export function otherPlayer<TState extends object, TInput extends object>(
  playerId: (input: TInput) => number,
): ActionValidator<TState, TInput> {
  return ({ actor, input, ctx }) => {
    const targetId = playerId(input);
    return targetId !== actor.id && ctx.players.get(targetId) != null;
  };
}

export function existingPawn<
  TState extends object,
  TInput extends object,
>(options: {
  setId: string;
  pawnId: (input: TInput) => string;
}): ActionValidator<TState, TInput> {
  return ({ input, ctx }) =>
    ctx.pawns
      .definitions(options.setId)
      .some((pawn) => pawn.id === options.pawnId(input));
}

export function legalMove<
  TState extends object,
  TInput extends object,
>(options: {
  setId: string;
  pawnId: (input: TInput) => string;
  distance: (input: TInput) => number;
  playerId?: (execution: GameActionExecution<TState, TInput>) => number;
}): ActionValidator<TState, TInput> {
  return (execution) => {
    const playerId = options.playerId?.(execution) ?? execution.actor.id;
    return execution.ctx.pawns
      .legalMoves(options.setId, playerId, options.distance(execution.input))
      .some((move) => move.pawnId === options.pawnId(execution.input));
  };
}

export function positiveInteger<TState extends object, TInput extends object>(
  value: (input: TInput) => number,
): ActionValidator<TState, TInput> {
  return ({ input }) => {
    const candidate = value(input);
    return Number.isInteger(candidate) && candidate > 0;
  };
}
