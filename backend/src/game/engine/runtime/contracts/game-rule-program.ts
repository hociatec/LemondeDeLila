import type { OptionalGameCapability } from './compiled-game-plan';
import type {
  GamePresentation,
  GameActionMap,
  GameActionDecision,
  GameViewExtension,
  ChoiceResolverShape,
  AutomaticRule,
  VictoryRule,
} from './author-rule-contracts';
import type { PlayerState } from '../../../core/application/models/game-state.model';

import type { GameContext } from '../definitions/game-author-context';
import type { PhaseConfiguration } from '../kits/phase-kit';
import type { TurnPolicy } from '../kits/turn-kit';
import type { GameShortcutHint } from '../../../shortcuts/public-api';
import type {
  GameComponentDefinition,
  GameInitialization,
} from '../definitions/component-kit';

import type { GameSingleActionDto } from '../../../core/application/models/game-action.model';

import type { VisibilityRule } from '../kits/visibility-kit';
import type { PlayerValuesVisibility } from '../kits/player-values-kit';
import type { GameLifecycleHooks } from '../lifecycle/game-lifecycle-hooks';
import type { GameConfigurationShape } from '../configuration/configuration-kit';
import type { GameContentShape } from '../content/game-content';
import type { GameEffectResolverShape } from './effect-resolver';

import type { GameEventDefinition } from '../events/game-event-definition';

export interface GameRuleProgram<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TViewExtension extends object = object,
  TInitialization extends GameInitialization = GameInitialization,
  TEvents extends readonly GameEventDefinition<string, object>[] =
    readonly GameEventDefinition<string, object>[],
> {
  readonly id: string;
  readonly displayName: string;
  readonly category: string;
  readonly subcategory?: string;
  readonly description?: string;
  readonly content?: GameContentShape;
  readonly capabilities?: readonly OptionalGameCapability[];
  readonly stateVersion?: number;
  readonly contentVersion?: string;
  readonly rulesVersion?: string;
  readonly shortcuts?: readonly GameShortcutHint[];
  readonly presentation?: GamePresentation;
  readonly players: { min: number; max: number };
  readonly components?: readonly GameComponentDefinition[];
  readonly initialization?: TInitialization;
  /** Resource catalogue for rules that create balances after setup. */
  readonly resourceIds?: readonly string[];
  /** Game-owned events compiled into the public player-view contract. */
  readonly events?: TEvents;
  readonly setup?: (input: {
    players: PlayerState[];
    ctx: GameContext<TState>;
  }) => TState;
  readonly actions: TActions;
  readonly choices?: Record<string, ChoiceResolverShape<TState>>;
  readonly turn?: TurnPolicy;
  readonly phases?: Record<string, PhaseConfiguration<TState>>;
  readonly initialPhase?: string;
  readonly automatic?: readonly AutomaticRule<TState>[];
  readonly lifecycle?: GameLifecycleHooks<TState>;
  readonly config?: GameConfigurationShape<TState>;
  readonly effects?: Readonly<Record<string, GameEffectResolverShape<TState>>>;
  readonly victory?: VictoryRule<TState>;
  readonly visibility?: Readonly<Record<string, VisibilityRule>>;
  /** Visibility policy applied to system score/resource/status projections. */
  readonly playerValuesVisibility?: PlayerValuesVisibility;
  /** Small game-authored addition merged into the generic PlayerView. */
  readonly viewExtension?: (input: {
    state: TState;
    actor: PlayerState | null;
    ctx: GameContext<TState>;
  }) => GameViewExtension<TViewExtension>;
  readonly bot?: {
    choose(input: {
      state: TState;
      actor: PlayerState;
      availableActions: Array<keyof TActions & string>;
      legalActions: readonly GameSingleActionDto[];
      ctx: GameContext<TState>;
    }): GameActionDecision<TActions> | null;
  };
}
