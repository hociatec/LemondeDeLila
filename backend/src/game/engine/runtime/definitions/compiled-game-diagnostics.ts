import type { GameLifecycleHooks } from '../lifecycle/game-lifecycle-hooks';
import type { GamePattern } from '../patterns/gameplay-patterns';
import type {
  CompiledGameDefinition,
  CompiledGameDiagnostics,
  GameActionMap,
} from './game-definition-contracts';

export type CompiledDescriptorInput<TState extends object = object> = Pick<
  CompiledGameDefinition<TState, GameActionMap<TState>, object>,
  | 'id'
  | 'patterns'
  | 'components'
  | 'actions'
  | 'phases'
  | 'choices'
  | 'effects'
  | 'events'
  | 'automatic'
  | 'lifecycle'
  | 'turn'
  | 'victory'
  | 'content'
  | 'stateVersion'
  | 'contentVersion'
  | 'rulesVersion'
>;

/** Builds the immutable authoring diagnostics exposed by a compiled game. */
export function describeCompiledGameDefinition<TState extends object>(
  definition: CompiledDescriptorInput<TState>,
): CompiledGameDiagnostics {
  return {
    compiledAt: 'defineGame',
    gameId: definition.id,
    patternIds: Object.freeze(
      (definition.patterns ?? []).map((pattern) => pattern.id),
    ),
    mechanics: Object.freeze([
      ...new Set(
        (definition.patterns ?? []).flatMap((pattern) => pattern.mechanics),
      ),
    ]),
    componentIds: Object.freeze(
      (definition.components ?? []).map(
        (component) => `${component.component}:${component.id}`,
      ),
    ),
    actionIds: Object.freeze(Object.keys(definition.actions)),
    phaseIds: Object.freeze(Object.keys(definition.phases ?? {})),
    choiceIds: Object.freeze(Object.keys(definition.choices ?? {})),
    effectIds: Object.freeze(Object.keys(definition.effects ?? {})),
    eventIds: Object.freeze(
      (definition.events ?? []).map((event) => event.type),
    ),
    automaticRuleIds: Object.freeze(
      (definition.automatic ?? []).map((rule) => rule.id),
    ),
    hookOrder: Object.freeze(lifecycleHookNames(definition.lifecycle)),
    lifecycleHookSources: Object.freeze(
      lifecycleHookSources(definition.patterns ?? [], definition.lifecycle),
    ),
    turnPolicy: definition.turn
      ? {
          kind: definition.turn.kind,
          ...(definition.turn.actionPoints == null
            ? {}
            : { actionPoints: definition.turn.actionPoints }),
        }
      : null,
    turnPolicySource: definition.turn
      ? 'game'
      : ((definition.patterns ?? []).find((pattern) => pattern.turn)?.id ??
        null),
    victoryPriority: Object.freeze(
      [
        definition.victory ? 'game' : null,
        (definition.patterns ?? []).some((pattern) => pattern.victory)
          ? 'pattern'
          : null,
      ].filter((source): source is 'game' | 'pattern' => source != null),
    ),
    actionSources: Object.freeze(actionSources(definition)),
    componentSources: Object.freeze(componentSources(definition)),
    phaseSources: Object.freeze(
      Object.fromEntries(
        Object.keys(definition.phases ?? {}).map((id) => [id, 'game']),
      ),
    ),
    choiceSources: Object.freeze(
      Object.fromEntries(
        Object.keys(definition.choices ?? {}).map((id) => [id, 'game']),
      ),
    ),
    effectSources: Object.freeze(
      Object.fromEntries(
        Object.keys(definition.effects ?? {}).map((id) => [id, 'game']),
      ),
    ),
    contentVersion: definition.contentVersion,
    stateVersion: definition.stateVersion,
    rulesVersion: definition.rulesVersion,
  };
}

function actionSources<TState extends object>(
  definition: Pick<
    CompiledGameDefinition<TState, GameActionMap<TState>, object>,
    'patterns' | 'actions'
  >,
): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const pattern of definition.patterns ?? []) {
    for (const actionId of Object.keys(pattern.actions ?? {})) {
      sources[actionId] = pattern.id;
    }
  }
  for (const [actionId, action] of Object.entries(definition.actions)) {
    sources[actionId] = action.overrides
      ? `game overrides ${action.overrides}`
      : 'game';
  }
  return sources;
}

function componentSources<TState extends object>(
  definition: Pick<
    CompiledGameDefinition<TState, GameActionMap<TState>, object>,
    'patterns' | 'components'
  >,
): Record<string, string> {
  const sources: Record<string, string> = {};
  for (const pattern of definition.patterns ?? []) {
    for (const component of pattern.components ?? []) {
      sources[`${component.component}:${component.id}`] = pattern.id;
    }
  }
  for (const component of definition.components ?? []) {
    sources[`${component.component}:${component.id}`] ??= 'game';
  }
  return sources;
}

function lifecycleHookSources<TState extends object>(
  patterns: readonly GamePattern<TState>[],
  gameHooks?: GameLifecycleHooks<TState>,
): Record<string, string[]> {
  const sources: Record<string, string[]> = {};
  for (const pattern of patterns) {
    for (const hook of lifecycleHookNames(pattern.lifecycle)) {
      (sources[hook] ??= []).push(pattern.id);
    }
  }
  for (const hook of lifecycleHookNames(gameHooks)) {
    (sources[hook] ??= []).push('game');
  }
  return sources;
}

function lifecycleHookNames<TState extends object>(
  hooks?: GameLifecycleHooks<TState>,
): string[] {
  return [
    hooks?.beforeTurn ? 'beforeTurn' : null,
    hooks?.afterTurn ? 'afterTurn' : null,
    hooks?.onRoundStart ? 'onRoundStart' : null,
    hooks?.onRoundEnd ? 'onRoundEnd' : null,
  ].filter((hook): hook is string => hook != null);
}
