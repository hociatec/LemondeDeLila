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
  readonly stateVersion: number;
  readonly rulesVersion: string;
  readonly migrations: readonly GameStateMigration<TState>[];
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
  readonly view?: (input: {
    state: TState;
    actor: PlayerStateEntity | null;
    ctx: GameContext<TState>;
  }) => GamePlayerProjection<TPlayerView, TExtras, TBoard>;
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

export type DeclarativeState<TState extends object> = GameStateEntity & {
  game: TState;
  engine: {
    schemaVersion: number;
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
  'kind' | 'content' | 'stateVersion' | 'rulesVersion' | 'migrations'
> & {
  readonly content?: GameContentShape;
  readonly stateVersion?: number;
  readonly rulesVersion?: string;
  readonly migrations?: readonly GameStateMigration<TState>[];
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
  TExtras extends object = object,
  TBoard extends object = object,
>(
  definition: Omit<
    GameDefinitionInput<TState, TActions, TState, TExtras, TBoard>,
    'view'
  > & {
    view?: undefined;
  },
): DeclarativeGameDefinition<TState, TActions, TState, TExtras, TBoard>;
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
  const components = [
    ...(patterns.components ?? []),
    ...(definition.components ?? []),
  ];
  const normalized = {
    stateVersion: 1,
    rulesVersion: '1',
    migrations: [],
    ...definition,
    patterns: [...(definition.patterns ?? [])],
    components,
    initialization: mergeInitialization(
      patterns.initialization,
      definition.initialization,
    ),
    turn: definition.turn ?? patterns.turn,
    lifecycle: mergeLifecycleHooks(patterns.lifecycle, definition.lifecycle),
    victory: mergeVictoryRules(definition.victory, patterns.victory),
    content:
      definition.content ??
      defineGameContent(definition.id, {
        components,
      }),
    initialPhase:
      definition.initialPhase ??
      Object.keys(definition.phases ?? {})[0] ??
      'playing',
    phases: definition.phases ?? {
      [definition.initialPhase ?? 'playing']: {},
    },
  };
  assertGameDefinition(normalized);
  return deepFreeze({ ...normalized, kind: GAME_DEFINITION_KIND });
}

function mergeInitialization(
  pattern?: GameInitialization,
  game?: GameInitialization,
): GameInitialization | undefined {
  if (!pattern) return game;
  if (!game) return pattern;
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
