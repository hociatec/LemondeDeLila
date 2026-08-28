import type { GameExecutionContext } from '../models/game-execution-context.model';
import type {
  GameStateEntity,
  PlayerStateEntity,
} from '../models/game-state.model';
import type { GameInputSchema } from './game-input-schema';
import type { GameContext } from './game-rule-context';
import type { PhaseConfiguration } from './phase-kit';
import type { TurnPolicy } from './turn-kit';
import type { GameShortcutHint } from '../../../shortcuts/public-api';
import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import type { CardsKitState } from './cards-kit';
import type { InventoryKitState } from './inventory-kit';
import type { EconomyKitState } from './economy-kit';
import type { OwnershipKitState } from './ownership-kit';
import type { DiceKitState } from './dice-kit';
import type { GridKitState } from './grid-kit';
import type { MovementKitState } from './movement-kit';
import type { QuizKitState } from './quiz-kit';
import type { PawnKitState } from './pawn-kit';
import type { GamePendingEvent } from '../models/game-event.model';
import type { GameSingleActionDto } from '../models/game-action.model';
import type { MatchKitState } from './match-kit';
import type { RoundKitState } from './round-kit';
import type { PlayerValuesKitState } from './player-values-kit';
import type { VisibilityRule } from './visibility-kit';
import type { PlayerValuesVisibility } from './player-values-kit';
import { assertGameDefinition } from './game-definition-validator';
import type { GameLifecycleHooks } from './game-lifecycle-hooks';
import type {
  GameConfigurationShape,
  GameConfigurationState,
} from './configuration-kit';
import { defineGameContent, type GameContentShape } from './game-content';
import type { EffectEngineState, GameEffectResolverShape } from './effects-kit';
import type { GameCommandJournalState } from './game-command-journal';
import type { SubmissionKitState } from './submission-kit';
import type { GameSchedulerState } from './scheduler-kit';
import { composePatterns, type GamePattern } from './gameplay-patterns';
import { GameConfigurationError } from '../../domain/errors/game-domain.errors';

export const GAME_DEFINITION_KIND = 'lila.game-definition' as const;

export type GameActionUiHint = {
  label?: string;
  icon?: string;
  intent?: 'primary' | 'secondary' | 'danger' | 'success';
  control?: 'button' | 'card' | 'player' | 'pawn' | 'number' | 'form';
  shortcut?: string;
};

export type GameChoiceUiHint = Omit<GameActionUiHint, 'intent' | 'shortcut'>;

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

export const GAME_PLAYER_VIEW_KIND = 'lila.game-player-view' as const;

export type GamePlayerProjection<
  TPlayerView extends object,
  TExtras extends object = object,
  TBoard extends object = object,
> = {
  readonly kind: typeof GAME_PLAYER_VIEW_KIND;
  readonly game: TPlayerView;
  readonly extras?: TExtras;
  readonly board?: TBoard;
};

/** Game-specific fragment merged beside the stable system and kit projections. */
export type GameViewExtension<TValue extends object> = Readonly<TValue>;

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
  input: Pick<GameInputSchema<never>, 'describe'>;
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

export interface DeclarativeGameDefinition<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
  TExtras extends object = object,
  TBoard extends object = object,
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
  readonly players: { min: number; max: number };
  readonly patterns?: readonly GamePattern<TState>[];
  readonly components?: readonly GameComponentDefinition[];
  readonly initialization?: GameInitialization;
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
  readonly view?: (input: {
    state: TState;
    actor: PlayerStateEntity | null;
    ctx: GameContext<TState>;
  }) => GamePlayerProjection<TPlayerView, TExtras, TBoard>;
  /** Small game-specific addition merged into the generic PlayerView. */
  readonly viewFragment?: (input: {
    state: TState;
    actor: PlayerStateEntity | null;
    ctx: GameContext<TState>;
  }) => GameViewExtension<TPlayerView>;
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
  TPlayerView extends object,
  TExtras extends object = object,
  TBoard extends object = object,
> = DeclarativeGameDefinition<TState, TActions, TPlayerView, TExtras, TBoard>;

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

type GameDefinitionInput<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
  TExtras extends object = object,
  TBoard extends object = object,
> = Omit<
  DeclarativeGameDefinition<TState, TActions, TPlayerView, TExtras, TBoard>,
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

export function defineGame<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
  TExtras extends object = object,
  TBoard extends object = object,
>(
  definition: GameDefinitionInput<
    TState,
    TActions,
    TPlayerView,
    TExtras,
    TBoard
  > & {
    view: NonNullable<
      DeclarativeGameDefinition<
        TState,
        TActions,
        TPlayerView,
        TExtras,
        TBoard
      >['view']
    >;
  },
): DeclarativeGameDefinition<TState, TActions, TPlayerView, TExtras, TBoard>;
export function defineGame<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object = TState,
  TExtras extends object = object,
  TBoard extends object = object,
>(
  definition: Omit<
    GameDefinitionInput<TState, TActions, TPlayerView, TExtras, TBoard>,
    'view'
  > & {
    view?: undefined;
  },
): DeclarativeGameDefinition<TState, TActions, TPlayerView, TExtras, TBoard>;
export function defineGame<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
  TExtras extends object = object,
  TBoard extends object = object,
>(
  definition: GameDefinitionInput<
    TState,
    TActions,
    TPlayerView,
    TExtras,
    TBoard
  >,
): DeclarativeGameDefinition<TState, TActions, TPlayerView, TExtras, TBoard> {
  const patterns = composePatterns(...(definition.patterns ?? []));
  assertNoImplicitComponentOverrides(
    patterns.components ?? [],
    definition.components ?? [],
    definition.id,
  );
  assertNoImplicitTurnOverride(patterns.turn, definition.turn, definition.id);
  const components = [
    ...(patterns.components ?? []),
    ...(definition.components ?? []),
  ];
  assertNoImplicitActionOverrides(
    patterns.actions ?? {},
    definition.actions,
    definition.id,
  );
  const content =
    definition.content ??
    defineGameContent(definition.id, {
      components,
    });
  const normalizedBase = {
    stateVersion: 1,
    rulesVersion: '1',
    migrations: [],
    contentMigrations: [],
    ...definition,
    content,
    contentVersion: definition.contentVersion ?? content.version,
    patterns: [...(definition.patterns ?? [])],
    components,
    actions: {
      ...(patterns.actions ?? {}),
      ...definition.actions,
    },
    initialization: mergeInitialization(
      patterns.initialization,
      definition.initialization,
    ),
    turn: definition.turn ?? patterns.turn,
    lifecycle: mergeLifecycleHooks(patterns.lifecycle, definition.lifecycle),
    victory: mergeVictoryRules(definition.victory, patterns.victory),
    initialPhase:
      definition.initialPhase ??
      Object.keys(definition.phases ?? {})[0] ??
      'playing',
    phases: definition.phases ?? {
      [definition.initialPhase ?? 'playing']: {},
    },
  };
  const normalized = {
    ...normalizedBase,
    compiled: describeCompiledGameDefinition(
      normalizedBase as unknown as DeclarativeGameDefinition<
        object,
        GameActionMap<object>,
        object
      >,
    ),
  };
  assertGameDefinition(normalized);
  return deepFreeze({ ...normalized, kind: GAME_DEFINITION_KIND });
}

export function describeCompiledGameDefinition(
  definition: Pick<
    DeclarativeGameDefinition<object, GameActionMap<object>, object>,
    | 'id'
    | 'patterns'
    | 'components'
    | 'actions'
    | 'phases'
    | 'choices'
    | 'effects'
    | 'automatic'
    | 'lifecycle'
    | 'turn'
    | 'victory'
    | 'content'
    | 'stateVersion'
    | 'contentVersion'
    | 'rulesVersion'
  >,
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
    automaticRuleIds: Object.freeze(
      (definition.automatic ?? []).map((rule) => rule.id),
    ),
    hookOrder: Object.freeze(
      [
        definition.lifecycle?.beforeTurn ? 'beforeTurn' : null,
        definition.lifecycle?.afterTurn ? 'afterTurn' : null,
        definition.lifecycle?.onRoundStart ? 'onRoundStart' : null,
        definition.lifecycle?.onRoundEnd ? 'onRoundEnd' : null,
      ].filter((hook): hook is string => hook != null),
    ),
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

function actionSources(
  definition: Pick<
    DeclarativeGameDefinition<object, GameActionMap<object>, object>,
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

function componentSources(
  definition: Pick<
    DeclarativeGameDefinition<object, GameActionMap<object>, object>,
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

function assertNoImplicitActionOverrides<TState extends object>(
  patternActions: GameActionMap<TState>,
  gameActions: GameActionMap<TState>,
  gameId: string,
): void {
  for (const [actionId, action] of Object.entries(gameActions)) {
    if (!(actionId in patternActions)) continue;
    if (action.overrides === actionId) continue;
    throw new GameConfigurationError(
      `Action "${actionId}" fournie par un pattern et redéfinie par "${gameId}" sans overrideAction() explicite`,
    );
  }
}

function mergeInitialization(
  pattern?: GameInitialization,
  game?: GameInitialization,
): GameInitialization | undefined {
  if (!pattern) return game;
  if (!game) return pattern;
  assertNoImplicitInitializationOverrides(pattern, game);
  return {
    ...pattern,
    ...game,
    scores: game.scores ?? pattern.scores,
    resources: { ...pattern.resources, ...game.resources },
    counters: { ...pattern.counters, ...game.counters },
    tracks: { ...pattern.tracks, ...game.tracks },
    pawns: [...(pattern.pawns ?? []), ...(game.pawns ?? [])],
  };
}

function assertNoImplicitComponentOverrides(
  patternComponents: readonly GameComponentDefinition[],
  gameComponents: readonly GameComponentDefinition[],
  gameId: string,
): void {
  const patternKeys = new Set(
    patternComponents.map(
      (component) => `${component.component}:${component.id}`,
    ),
  );
  for (const component of gameComponents) {
    const key = `${component.component}:${component.id}`;
    if (patternKeys.has(key) && component.overrides !== key) {
      throw new GameConfigurationError(
        `Composant "${key}" fourni par un pattern et redéfini par "${gameId}" sans overrideComponent() explicite`,
      );
    }
  }
}

function assertNoImplicitTurnOverride(
  pattern: TurnPolicy | undefined,
  game: TurnPolicy | undefined,
  gameId: string,
): void {
  if (!pattern || !game || sameTurnPolicy(pattern, game)) return;
  if (game.overrides) return;
  throw new GameConfigurationError(
    `Politique de tour fournie par un pattern et redéfinie par "${gameId}" sans overrideTurn() explicite`,
  );
}

function assertNoImplicitInitializationOverrides(
  pattern: GameInitialization,
  game: GameInitialization,
): void {
  const overrides = new Set(game.overrides ?? []);
  const assertKeys = (
    kind: 'resources' | 'counters' | 'tracks',
    labels: Readonly<Record<string, unknown>> | undefined,
    inherited: Readonly<Record<string, unknown>> | undefined,
  ) => {
    for (const key of Object.keys(labels ?? {})) {
      if (!(key in (inherited ?? {}))) continue;
      const overrideKey = `${kind}.${key}`;
      if (!overrides.has(overrideKey)) {
        throw new GameConfigurationError(
          `Initialisation ${overrideKey} fournie par un pattern et redéfinie sans overrideInitialization(["${overrideKey}"], ...) explicite`,
        );
      }
    }
  };
  assertKeys('resources', game.resources, pattern.resources);
  assertKeys('counters', game.counters, pattern.counters);
  assertKeys('tracks', game.tracks, pattern.tracks);
  if (
    game.scores != null &&
    pattern.scores != null &&
    !overrides.has('scores')
  ) {
    throw new GameConfigurationError(
      'Initialisation scores fournie par un pattern et redéfinie sans overrideInitialization(["scores"], ...) explicite',
    );
  }
  const patternPawns = new Set((pattern.pawns ?? []).map((pawn) => pawn.setId));
  for (const pawn of game.pawns ?? []) {
    const overrideKey = `pawns.${pawn.setId}`;
    if (patternPawns.has(pawn.setId) && !overrides.has(overrideKey)) {
      throw new GameConfigurationError(
        `Initialisation ${overrideKey} fournie par un pattern et redéfinie sans overrideInitialization(["${overrideKey}"], ...) explicite`,
      );
    }
  }
}

function sameTurnPolicy(left: TurnPolicy, right: TurnPolicy): boolean {
  return left.kind === right.kind && left.actionPoints === right.actionPoints;
}

function mergeLifecycleHooks<TState extends object>(
  patternHooks?: GameLifecycleHooks<TState>,
  gameHooks?: GameLifecycleHooks<TState>,
): GameLifecycleHooks<TState> | undefined {
  if (!patternHooks) return gameHooks;
  if (!gameHooks) return patternHooks;
  return {
    beforeTurn: mergeHook(patternHooks.beforeTurn, gameHooks.beforeTurn),
    afterTurn: mergeHook(patternHooks.afterTurn, gameHooks.afterTurn),
    onRoundStart: mergeHook(patternHooks.onRoundStart, gameHooks.onRoundStart),
    onRoundEnd: mergeHook(patternHooks.onRoundEnd, gameHooks.onRoundEnd),
  };
}

function mergeHook<TInput>(
  first?: (input: TInput) => void,
  second?: (input: TInput) => void,
): ((input: TInput) => void) | undefined {
  if (!first) return second;
  if (!second) return first;
  return (input) => {
    first(input);
    second(input);
  };
}

function mergeVictoryRules<TState extends object>(
  gameRule?: VictoryRule<TState>,
  patternRule?: VictoryRule<TState>,
): VictoryRule<TState> | undefined {
  if (!gameRule) return patternRule;
  if (!patternRule) return gameRule;
  return {
    evaluate: (input) =>
      gameRule.evaluate(input) ?? patternRule.evaluate(input),
  };
}

export function defineAction<TState extends object, TInput extends object>(
  action: GameActionDefinition<TState, TInput>,
): DefinedGameAction<TState, TInput> {
  return Object.freeze({
    ...action,
    parseInput: (payload: Record<string, unknown>) =>
      action.input.parse(payload),
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
        value: choice.input.parse(rawValue, 'choice.value'),
      }),
  });
}

export function playerView<
  TPlayerView extends object,
  TExtras extends object = object,
  TBoard extends object = object,
>(
  projection: Omit<GamePlayerProjection<TPlayerView, TExtras, TBoard>, 'kind'>,
): GamePlayerProjection<TPlayerView, TExtras, TBoard> {
  return {
    ...structuredClone(projection),
    kind: GAME_PLAYER_VIEW_KIND,
  };
}

/** Preferred helper for a minimal game-specific `viewFragment`. */
export function gameViewExtension<TValue extends object>(
  extension: TValue,
): GameViewExtension<TValue> {
  return structuredClone(extension);
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (
    value == null ||
    (typeof value !== 'object' && typeof value !== 'function') ||
    Object.isFrozen(value)
  ) {
    return value;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

export function isGamePlayerProjection<TPlayerView extends object>(
  value: unknown,
): value is GamePlayerProjection<TPlayerView> {
  return (
    value != null &&
    typeof value === 'object' &&
    'kind' in value &&
    value.kind === GAME_PLAYER_VIEW_KIND &&
    'game' in value
  );
}

export function isGameDefinition(
  value: unknown,
): value is DeclarativeGameDefinition<object, GameActionMap<object>, object> {
  return (
    value != null &&
    typeof value === 'object' &&
    (value as { kind?: unknown }).kind === GAME_DEFINITION_KIND
  );
}

export type RuntimeExecution = GameExecutionContext;
