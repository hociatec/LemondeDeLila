import type { CompiledGamePlan, CompiledPattern } from './compiled-game-plan';
import type { GameRuleProgram } from './game-rule-program';
import type { GameActionMap } from './author-rule-contracts';
import type { GameInitialization } from '../definitions/component-kit';
import type { GameEventDefinition } from '../events/game-event-definition';
import type { GameContentShape } from '../content/game-content';
import type { TurnPolicy } from '../kits/turn-kit';
export const GAME_DEFINITION_KIND = 'lila.game-definition' as const;
/** Only normalized execution rules and a data-only plan cross the runtime boundary. */
export interface CompiledGameDefinition<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TViewExtension extends object = object,
  TInitialization extends GameInitialization = GameInitialization,
  TEvents extends readonly GameEventDefinition<string, object>[] =
    readonly GameEventDefinition<string, object>[],
  TPatterns extends readonly CompiledPattern[] = readonly CompiledPattern[],
> extends Omit<
  GameRuleProgram<TState, TActions, TViewExtension, TInitialization, TEvents>,
  | 'capabilities'
  | 'content'
  | 'stateVersion'
  | 'contentVersion'
  | 'rulesVersion'
> {
  readonly kind: typeof GAME_DEFINITION_KIND;
  readonly content: GameContentShape;
  readonly contentDigest: string;
  readonly stateVersion: number;
  readonly contentVersion: string;
  readonly rulesVersion: string;
  readonly compiled: CompiledGameDiagnostics;
  readonly plan: CompiledGamePlan;
  readonly capabilities: CompiledGamePlan['capabilities'];
  readonly patterns: readonly Pick<TPatterns[number], 'id' | 'mechanics'>[];
}

export type CompiledGameDiagnostics = {
  readonly compiledAt: 'defineGame';
  readonly gameId: string;
  readonly patternIds: readonly string[];
  readonly mechanics: readonly string[];
  readonly componentIds: readonly string[];
  readonly actionIds: readonly string[];
  readonly phaseIds: readonly string[];
  readonly choiceIds: readonly string[];
  readonly effectIds: readonly string[];
  readonly eventIds: readonly string[];
  readonly automaticRuleIds: readonly string[];
  readonly hookOrder: readonly string[];
  readonly lifecycleHookSources: Readonly<Record<string, readonly string[]>>;
  readonly turnPolicy: {
    readonly kind: TurnPolicy['kind'];
    readonly actionPoints?: number;
  } | null;
  readonly turnPolicySource: string | null;
  readonly victoryPriority: readonly ('game' | 'pattern')[];
  readonly actionSources: Readonly<Record<string, string>>;
  readonly componentSources: Readonly<Record<string, string>>;
  readonly phaseSources: Readonly<Record<string, string>>;
  readonly choiceSources: Readonly<Record<string, string>>;
  readonly effectSources: Readonly<Record<string, string>>;
  readonly contentVersion: string;
  readonly stateVersion: number;
  readonly rulesVersion: string;
};
