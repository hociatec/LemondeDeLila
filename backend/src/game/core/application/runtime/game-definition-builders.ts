import type { GameExecutionContext } from '../models/game-execution-context.model';
import type { PlayerStateEntity } from '../models/game-state.model';
import type { GameContext } from './game-rule-context';
import { parseRuntimeInput } from './parsed-input';
import {
  GAME_DEFINITION_KIND,
  type ChoiceResolver,
  type CompiledGameDefinition,
  type DefinedChoiceResolver,
  type DefinedGameAction,
  type GameActionDefinition,
  type GameActionExecution,
  type GameActionMap,
  type GameViewExtension,
  type RawChoiceResolution,
  type ReservedGameViewKeys,
} from './game-definition-contracts';

export function defineAction<TState extends object, TInput extends object>(
  action: GameActionDefinition<TState, TInput>,
): DefinedGameAction<TState, TInput> {
  return Object.freeze({
    ...action,
    parseInput: (payload: Record<string, unknown>) =>
      parseRuntimeInput(action.input, payload, 'action.payload'),
    ...(action.validate
      ? {
          validateInput: (input: GameActionExecution<TState, object>) =>
            action.validate?.({ ...input, input: input.input as TInput }) ??
            true,
        }
      : {}),
    ...(action.enumerate
      ? {
          enumerateInputs: (input: {
            state: TState;
            actor: PlayerStateEntity;
            ctx: GameContext<TState>;
          }) => action.enumerate?.(input) ?? [],
        }
      : {}),
    ...(action.candidates
      ? {
          enumerateCandidateInputs: (input: {
            state: TState;
            actor: PlayerStateEntity;
            ctx: GameContext<TState>;
            query: Readonly<Record<string, unknown>>;
            offset: number;
            limit: number;
          }) => action.candidates?.(input) ?? [],
        }
      : {}),
    executeInput: (input: GameActionExecution<TState, object>) =>
      action.execute({ ...input, input: input.input as TInput }),
  });
}

export function overrideAction<TState extends object, TInput extends object>(
  actionId: string,
  action: GameActionDefinition<TState, TInput>,
): DefinedGameAction<TState, TInput> {
  return defineAction({
    ...action,
    overrides: actionId,
  });
}

export function defineChoice<TState extends object, TValue>(
  choice: ChoiceResolver<TState, TValue>,
): DefinedChoiceResolver<TState, TValue> {
  return Object.freeze({
    ...choice,
    resolveRaw: ({ rawValue, ...resolution }: RawChoiceResolution<TState>) =>
      choice.resolve({
        ...resolution,
        value: parseRuntimeInput(choice.input, rawValue, 'choice.value'),
      }),
  });
}

/** Preferred helper for a minimal game-specific `viewExtension`. */
export function gameViewExtension<TValue extends object>(
  extension: TValue & ReservedGameViewKeys,
): GameViewExtension<TValue> {
  return structuredClone(extension);
}

export function isGameDefinition(
  value: unknown,
): value is CompiledGameDefinition<object, GameActionMap<object>, object> {
  return (
    value != null &&
    typeof value === 'object' &&
    (value as { kind?: unknown }).kind === GAME_DEFINITION_KIND
  );
}

export type RuntimeExecution = GameExecutionContext;
