import type {
  GameStateEntity,
  PlayerStateEntity,
} from '../../../core/application/contracts/game-state.model';
import type {
  GameInputDescriptor,
  GameInputSchema,
} from '../actions/game-input-schema';
import type { GameContext } from '../game-rule-context';
import type { PhaseConfiguration } from '../kits/phase-kit';
import type { TurnPolicy } from '../kits/turn-kit';
import type { GameShortcutHint } from '../../../shortcuts/public-api';
import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import type { CardsKitState } from '../cards/cards-kit';
import type { InventoryKitState } from '../kits/inventory-kit';
import type { EconomyKitState } from '../kits/economy-kit';
import type { OwnershipKitState } from '../kits/ownership-kit';
import type { DiceKitState } from '../kits/dice-kit';
import type { GridKitState } from '../kits/grid-kit';
import type { MovementKitState } from '../kits/movement-kit';
import type { QuizKitState } from '../kits/quiz-kit';
import type { PawnKitState } from '../kits/pawn-kit';
import type { GamePendingEvent } from '../../../core/application/contracts/game-event.model';
import type { GameSingleActionDto } from '../../../core/application/contracts/game-action.model';
import type { MatchKitState } from '../kits/match-kit';
import type { RoundKitState } from '../kits/round-kit';
import type { PlayerValuesKitState } from '../kits/player-values-kit';
import type { VisibilityRule } from '../kits/visibility-kit';
import type { PlayerValuesVisibility } from '../kits/player-values-kit';
import type { GameLifecycleHooks } from '../lifecycle/game-lifecycle-hooks';
import type {
  GameConfigurationShape,
  GameConfigurationState,
} from '../configuration/configuration-kit';
import type { GameContentShape } from '../content/game-content';
import type {
  EffectEngineState,
  GameEffectResolverShape,
} from '../effects/effects-kit';
import type { GameCommandJournalState } from '../actions/game-command-journal';
import type { SubmissionKitState } from '../submissions/submission-kit';
import type { GameSchedulerState } from '../automation/scheduler-kit';
import type { GamePattern } from '../patterns/gameplay-patterns';
import type { GameEventDefinition } from '../events/game-event-definition';

export const GAME_DEFINITION_KIND = 'lila.game-definition' as const;

export type GameActionUiHint = {
  label?: string;
  icon?: string;
  intent?: 'primary' | 'secondary' | 'danger' | 'success';
  control?: 'button' | 'card' | 'player' | 'pawn' | 'number' | 'form';
  shortcut?: string;
};

export type GameChoiceUiHint = Omit<GameActionUiHint, 'intent' | 'shortcut'>;

export type GamePresentation = {
  score?: {
    label: string;
    unit: { singular: string; plural: string };
    changeNarration?: 'total' | 'delta-and-total';
  };
};

/**
 * Existential action shape used only as a generic constraint. Payloads remain
 * exact on the concrete action map while the runtime may enumerate actions
 * without widening every callback to `unknown`.
 */
export interface GameActionShape<TState extends object> {
  input: GameInputSchema<object>;
  parseInput?(payload: Record<string, unknown>): object;
  available?: (input: {
    state: TState;
    actor: PlayerStateEntity;
    ctx: GameContext<TState>;
  }) => boolean;
  validateInput?(input: GameActionExecution<TState, object>): boolean;
  enumerateInputs?: (input: {
    state: TState;
    actor: PlayerStateEntity;
    ctx: GameContext<TState>;
  }) => readonly object[];
  enumerateCandidateInputs?: (input: {
    state: TState;
    actor: PlayerStateEntity;
    ctx: GameContext<TState>;
    query: Readonly<Record<string, unknown>>;
    offset: number;
    limit: number;
  }) => readonly object[];
  executeInput?(input: GameActionExecution<TState, object>): void;
  documentation?: string;
  ui?: GameActionUiHint;
  overrides?: string;
}

export type GameActionMap<TState extends object> = Readonly<
  Record<string, GameActionShape<TState>>
>;

export type GameActionExecution<TState extends object, TInput> = {
  state: TState;
  actor: PlayerStateEntity;
  input: TInput;
  ctx: GameContext<TState>;
};

export interface GameActionDefinition<
  TState extends object,
  TInput extends object,
> {
  input: GameInputSchema<TInput>;
  available?: (input: {
    state: TState;
    actor: PlayerStateEntity;
    ctx: GameContext<TState>;
  }) => boolean;
  validate?(input: GameActionExecution<TState, TInput>): boolean;
  enumerate?: (input: {
    state: TState;
    actor: PlayerStateEntity;
    ctx: GameContext<TState>;
  }) => readonly TInput[];
  /** Server-side candidate query for potentially large input domains. */
  candidates?: (input: {
    state: TState;
    actor: PlayerStateEntity;
    ctx: GameContext<TState>;
    query: Readonly<Record<string, unknown>>;
    offset: number;
    limit: number;
  }) => readonly TInput[];
  execute(input: GameActionExecution<TState, TInput>): void;
  documentation?: string;
  ui?: GameActionUiHint;
  overrides?: string;
}

export type DefinedGameAction<
  TState extends object,
  TInput extends object,
> = GameActionDefinition<TState, TInput> & GameActionShape<TState>;

export type GameActionInput<TAction> = TAction extends {
  input: GameInputSchema<infer TInput>;
}
  ? TInput
  : never;

export type GameActionDecision<
  TActions extends Readonly<Record<string, { input: GameInputSchema<object> }>>,
> = {
  [TType in keyof TActions & string]: keyof GameActionInput<
    TActions[TType]
  > extends never
    ? { type: TType; payload?: GameActionInput<TActions[TType]> }
    : { type: TType; payload: GameActionInput<TActions[TType]> };
}[keyof TActions & string];

export type ReservedGameViewKeys = {
  readonly viewVersion?: never;
  readonly system?: never;
  readonly kits?: never;
  readonly effect?: never;
};

/** Game-specific fragment isolated under `game`; engine namespaces are reserved. */
export type GameViewExtension<TValue extends object> = Readonly<
  TValue & ReservedGameViewKeys
>;

/** Explicit marker for games whose complete mutable state lives in engine kits. */
export type NoGameState = Record<string, never>;

export type ChoiceResolution<TState extends object, TValue> = {
  state: TState;
  actor: PlayerStateEntity;
  value: TValue;
  ctx: GameContext<TState>;
};

export type RawChoiceResolution<TState extends object> = {
  state: TState;
  actor: PlayerStateEntity;
  rawValue: unknown;
  ctx: GameContext<TState>;
};

export interface ChoiceResolverShape<TState extends object> {
  input: GameInputDescriptor;
  documentation?: string;
  ui?: GameChoiceUiHint;
  resolveRaw(input: RawChoiceResolution<TState>): void;
}

export interface ChoiceResolver<TState extends object, TValue> {
  input: GameInputSchema<TValue>;
  documentation?: string;
  ui?: GameChoiceUiHint;
  resolve(input: {
    state: TState;
    actor: PlayerStateEntity;
    value: TValue;
    ctx: GameContext<TState>;
  }): void;
}

export type DefinedChoiceResolver<
  TState extends object,
  TValue,
> = ChoiceResolver<TState, TValue> & ChoiceResolverShape<TState>;

export interface AutomaticRule<TState extends object> {
  id: string;
  /** Higher priorities run first. Equal priorities retain declaration order. */
  priority?: number;
  when(input: { state: TState; ctx: GameContext<TState> }): boolean;
  apply(input: { state: TState; ctx: GameContext<TState> }): void;
}

export interface VictoryRule<TState extends object> {
  evaluate(input: { state: TState; ctx: GameContext<TState> }): {
    winnerPlayerIds: number[];
    reason?: string;
    ranking?: number[][];
  } | null;
}

export type GameStateMigration<TState extends object> = {
  from: number;
  to: number;
  migrate(state: TState): TState;
};

/** Migrates persisted references when a static content catalogue changes. */
export type GameContentMigration<TState extends object> = {
  from: string;
  to: string;
  migrate(state: DeclarativeState<TState>): void;
};

export interface CompiledGameDefinition<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TViewExtension extends object = object,
  TInitialization extends GameInitialization = GameInitialization,
  TEvents extends readonly GameEventDefinition<string, object>[] =
    readonly GameEventDefinition<string, object>[],
  TPatterns extends readonly GamePattern<TState>[] =
    readonly GamePattern<TState>[],
> {
  readonly kind: typeof GAME_DEFINITION_KIND;
  readonly id: string;
  readonly displayName: string;
  readonly category: string;
  readonly subcategory?: string;
  readonly description?: string;
  readonly content: GameContentShape;
  readonly compiled: CompiledGameDiagnostics;
  readonly stateVersion: number;
  readonly contentVersion: string;
  readonly rulesVersion: string;
  readonly migrations: readonly GameStateMigration<TState>[];
  readonly contentMigrations: readonly GameContentMigration<TState>[];
  readonly shortcuts?: readonly GameShortcutHint[];
  readonly presentation?: GamePresentation;
  readonly players: { min: number; max: number };
  readonly patterns?: TPatterns;
  readonly components?: readonly GameComponentDefinition[];
  readonly initialization?: TInitialization;
  /** Game-owned events compiled into the public player-view contract. */
  readonly events?: TEvents;
  readonly setup?: (input: {
    players: PlayerStateEntity[];
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
  /** Small game-specific addition merged into the generic PlayerView. */
  readonly viewExtension?: (input: {
    state: TState;
    actor: PlayerStateEntity | null;
    ctx: GameContext<TState>;
  }) => GameViewExtension<TViewExtension>;
  readonly bot?: {
    choose(input: {
      state: TState;
      actor: PlayerStateEntity;
      availableActions: Array<keyof TActions & string>;
      legalActions: readonly GameSingleActionDto[];
      ctx: GameContext<TState>;
    }): GameActionDecision<TActions> | null;
  };
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

export type DeclarativeState<TState extends object> = GameStateEntity & {
  game: TState;
  engine: {
    schemaVersion: number;
    contentVersion: string;
    rulesVersion: string;
    kits: EngineKitsState;
    pendingEvents?: GamePendingEvent[];
    match: MatchKitState;
    round: RoundKitState;
    playerValues: PlayerValuesKitState;
    configuration: GameConfigurationState;
    effects: EffectEngineState;
    commands: GameCommandJournalState;
    submissions: SubmissionKitState;
    scheduler: GameSchedulerState;
  };
};

export type GameSession<TState extends object> = DeclarativeState<TState>;
export type GameDefinition<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TViewExtension extends object = object,
  TInitialization extends GameInitialization = GameInitialization,
  TEvents extends readonly GameEventDefinition<string, object>[] =
    readonly GameEventDefinition<string, object>[],
  TPatterns extends readonly GamePattern<TState>[] =
    readonly GamePattern<TState>[],
> = CompiledGameDefinition<
  TState,
  TActions,
  TViewExtension,
  TInitialization,
  TEvents,
  TPatterns
>;

export type EngineKitsState = {
  cards?: CardsKitState;
  inventory?: InventoryKitState;
  economy?: EconomyKitState;
  ownership?: OwnershipKitState;
  movement?: MovementKitState;
  pawns?: PawnKitState;
  dice?: DiceKitState;
  grid?: GridKitState;
  quiz?: QuizKitState;
};

export type GameDefinitionInput<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TViewExtension extends object = object,
  TInitialization extends GameInitialization = GameInitialization,
  TEvents extends readonly GameEventDefinition<string, object>[] =
    readonly GameEventDefinition<string, object>[],
  TPatterns extends readonly GamePattern<TState>[] =
    readonly GamePattern<TState>[],
> = Omit<
  CompiledGameDefinition<
    TState,
    TActions,
    TViewExtension,
    TInitialization,
    TEvents,
    TPatterns
  >,
  | 'kind'
  | 'content'
  | 'compiled'
  | 'stateVersion'
  | 'contentVersion'
  | 'rulesVersion'
  | 'migrations'
  | 'contentMigrations'
> & {
  readonly content?: GameContentShape;
  readonly stateVersion?: number;
  readonly contentVersion?: string;
  readonly rulesVersion?: string;
  readonly migrations?: readonly GameStateMigration<TState>[];
  readonly contentMigrations?: readonly GameContentMigration<TState>[];
};
