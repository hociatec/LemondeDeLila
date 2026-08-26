import type { GameExecutionContext } from '../models/game-execution-context.model';
import type {
  GameStateEntity,
  PlayerStateEntity,
} from '../models/game-state.model';
import type { GameInputSchema } from './game-input-schema';
import type { GameRuleContext } from './game-rule-context';
import type { PhaseConfiguration } from './phase-kit';
import type { TurnPolicy } from './turn-kit';
import type { GameShortcutHint } from '../../../shortcuts/public-api';
import type { GameComponentDefinition } from './component-kit';
import type { CardsKitState } from './cards-kit';
import type { DiceKitState } from './dice-kit';
import type { GridKitState } from './grid-kit';
import type { MovementKitState } from './movement-kit';
import type { QuizKitState } from './quiz-kit';
import type { GamePendingEvent } from '../models/game-event.model';

export const GAME_DEFINITION_KIND = 'lila.game-definition' as const;

export type GameActionMap<TState extends object> = Record<
  string,
  GameActionDefinition<TState, unknown>
>;

export type GameActionExecution<TState extends object, TInput> = {
  state: TState;
  actor: PlayerStateEntity;
  input: TInput;
  ctx: GameRuleContext<TState>;
};

export interface GameActionDefinition<TState extends object, TInput> {
  input: GameInputSchema<TInput>;
  available?: (input: {
    state: TState;
    actor: PlayerStateEntity;
    ctx: GameRuleContext<TState>;
  }) => boolean;
  availableInputs?: (input: {
    state: TState;
    actor: PlayerStateEntity;
    ctx: GameRuleContext<TState>;
  }) => readonly TInput[];
  execute(input: GameActionExecution<TState, TInput>): void | TState;
  documentation?: string;
}

export const GAME_PLAYER_VIEW_KIND = 'lila.game-player-view' as const;

export type GamePlayerProjection<TPlayerView extends object> = {
  readonly kind: typeof GAME_PLAYER_VIEW_KIND;
  readonly game: TPlayerView;
  readonly extras?: Record<string, unknown>;
  readonly board?: unknown;
};

export interface ChoiceResolver<TState extends object> {
  resolve(input: {
    state: TState;
    actor: PlayerStateEntity;
    value: unknown;
    ctx: GameRuleContext<TState>;
  }): void | TState;
}

export interface AutomaticRule<TState extends object> {
  id: string;
  when(input: { state: TState; ctx: GameRuleContext<TState> }): boolean;
  apply(input: { state: TState; ctx: GameRuleContext<TState> }): void | TState;
}

export interface VictoryRule<TState extends object> {
  evaluate(input: {
    state: TState;
    ctx: GameRuleContext<TState>;
  }): { winnerPlayerIds: number[]; reason?: string } | null;
}

export interface DeclarativeGameDefinition<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
> {
  readonly kind: typeof GAME_DEFINITION_KIND;
  readonly id: string;
  readonly displayName: string;
  readonly category: string;
  readonly subcategory?: string;
  readonly description?: string;
  readonly shortcuts?: readonly GameShortcutHint[];
  readonly players: { min: number; max: number };
  readonly components?: readonly GameComponentDefinition[];
  readonly setup: (input: {
    players: PlayerStateEntity[];
    ctx: GameRuleContext<TState>;
  }) => TState;
  readonly actions: TActions;
  readonly choices?: Record<string, ChoiceResolver<TState>>;
  readonly turn?: TurnPolicy;
  readonly phases?: Record<string, PhaseConfiguration<TState>>;
  readonly initialPhase?: string;
  readonly automatic?: readonly AutomaticRule<TState>[];
  readonly victory?: VictoryRule<TState>;
  readonly view: (input: {
    state: TState;
    actor: PlayerStateEntity | null;
    ctx: GameRuleContext<TState>;
  }) => TPlayerView | GamePlayerProjection<TPlayerView>;
  readonly bot?: {
    choose(input: {
      state: TState;
      actor: PlayerStateEntity;
      availableActions: string[];
      ctx: GameRuleContext<TState>;
    }): {
      type: keyof TActions & string;
      payload?: Record<string, unknown>;
    } | null;
  };
}

export type DeclarativeState<TState extends object> = GameStateEntity & {
  game: TState;
  engine: {
    version: number;
    status: string;
    players: PlayerStateEntity[];
    turn: GameStateEntity['turn'];
    phase: string;
    pending: GameStateEntity['pending'];
    rng: { seed: number; counter: number };
    eventSequence: number;
    kits: EngineKitsState;
    pendingEvents?: GamePendingEvent[];
  };
};

export type EngineKitsState = {
  cards: CardsKitState;
  movement: MovementKitState;
  dice: DiceKitState;
  grid: GridKitState;
  quiz: QuizKitState;
};

export function defineGame<
  TState extends object,
  TActions extends GameActionMap<TState>,
  TPlayerView extends object,
>(
  definition: Omit<
    DeclarativeGameDefinition<TState, TActions, TPlayerView>,
    'kind'
  >,
): DeclarativeGameDefinition<TState, TActions, TPlayerView> {
  assertDefinition(definition);
  return Object.freeze({ ...definition, kind: GAME_DEFINITION_KIND });
}

export function defineAction<TState extends object, TInput>(
  action: GameActionDefinition<TState, TInput>,
): GameActionDefinition<TState, TInput> {
  return Object.freeze(action);
}

export function playerView<TPlayerView extends object>(
  projection: Omit<GamePlayerProjection<TPlayerView>, 'kind'>,
): GamePlayerProjection<TPlayerView> {
  return { ...projection, kind: GAME_PLAYER_VIEW_KIND };
}

export function isGamePlayerProjection<TPlayerView extends object>(
  value: TPlayerView | GamePlayerProjection<TPlayerView>,
): value is GamePlayerProjection<TPlayerView> {
  return (
    'kind' in value && value.kind === GAME_PLAYER_VIEW_KIND && 'game' in value
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

function assertDefinition(definition: {
  id: string;
  players: { min: number; max: number };
  actions: object;
}): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.id)) {
    throw new Error(`Identifiant de jeu invalide: ${definition.id}`);
  }
  if (
    definition.players.min < 1 ||
    definition.players.max < definition.players.min
  ) {
    throw new Error(`Limites de joueurs invalides: ${definition.id}`);
  }
  if (Object.keys(definition.actions).length === 0) {
    throw new Error(
      `Le jeu ${definition.id} doit déclarer au moins une action`,
    );
  }
}

export type RuntimeExecution = GameExecutionContext;
