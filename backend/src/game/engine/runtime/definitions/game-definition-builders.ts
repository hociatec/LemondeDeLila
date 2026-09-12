import type { GameExecutionContext } from '../../../core/application/models/game-execution-context.model';

import {
  GAME_DEFINITION_KIND,
  type CompiledGameDefinition,
} from './game-definition-contracts';
import {
  type GameActionMap,
  type GameViewExtension,
  type ReservedGameViewKeys,
} from '../contracts/author-rule-contracts';

/** Preferred helper for a minimal game-authored `viewExtension`. */
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

export {
  defineAction,
  defineChoice,
  overrideAction,
} from '../actions/action-builders';
