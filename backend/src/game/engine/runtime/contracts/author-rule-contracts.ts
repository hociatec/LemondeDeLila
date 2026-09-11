import type { PlayerState } from '../../../core/application/models/game-state.model';
import type {
  GameInputDescriptor,
  GameInputSchema,
} from '../actions/game-input-schema';
import type { GameContext } from '../definitions/game-author-context';

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
    visibility?: 'always' | 'active-match';
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
    actor: PlayerState;
    ctx: GameContext<TState>;
  }) => boolean;
  validateInput?(input: GameActionExecution<TState, object>): boolean;
  enumerateInputs?: (input: {
    state: TState;
    actor: PlayerState;
    ctx: GameContext<TState>;
  }) => readonly object[];
  enumerateCandidateInputs?: (input: {
    state: TState;
    actor: PlayerState;
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
  actor: PlayerState;
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
    actor: PlayerState;
    ctx: GameContext<TState>;
  }) => boolean;
  validate?(input: GameActionExecution<TState, TInput>): boolean;
  enumerate?: (input: {
    state: TState;
    actor: PlayerState;
    ctx: GameContext<TState>;
  }) => readonly TInput[];
  /** Server-side candidate query for potentially large input domains. */
  candidates?: (input: {
    state: TState;
    actor: PlayerState;
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
  actor: PlayerState;
  value: TValue;
  ctx: GameContext<TState>;
};

export type RawChoiceResolution<TState extends object> = {
  state: TState;
  actor: PlayerState;
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
    actor: PlayerState;
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
