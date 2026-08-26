import type { PlayerStateEntity } from '../models/game-state.model';
import type { GameInputSchema } from './game-input-schema';
import type { GameContext } from './game-rule-context';

export const GAME_CONFIGURE_ACTION = 'game.configure' as const;

export type GameConfigurationState = {
  ownerPlayerId: number | null;
  complete: boolean;
  values: Record<string, unknown>;
};

export type GameConfigurationUi = {
  title?: string;
  description?: string;
  submitLabel?: string;
};

export interface GameConfigurationShape<TState extends object> {
  input: GameInputSchema<object>;
  defaults: object;
  phase?: string;
  permission?: 'owner' | 'any-player';
  ui?: GameConfigurationUi;
  validate?(input: {
    state: TState;
    actor: PlayerStateEntity;
    config: object;
    ctx: GameContext<TState>;
  }): boolean;
  onConfigured?(input: {
    state: TState;
    actor: PlayerStateEntity;
    config: object;
    ctx: GameContext<TState>;
  }): void;
}

export interface GameConfigurationDefinition<
  TState extends object,
  TConfig extends object,
> {
  input: GameInputSchema<TConfig>;
  defaults: TConfig;
  phase?: string;
  permission?: 'owner' | 'any-player';
  ui?: GameConfigurationUi;
  validate?(input: {
    state: TState;
    actor: PlayerStateEntity;
    config: TConfig;
    ctx: GameContext<TState>;
  }): boolean;
  onConfigured?(input: {
    state: TState;
    actor: PlayerStateEntity;
    config: TConfig;
    ctx: GameContext<TState>;
  }): void;
}

export function defineConfiguration<
  TState extends object,
  TConfig extends object,
>(
  definition: GameConfigurationDefinition<TState, TConfig>,
): GameConfigurationDefinition<TState, TConfig> {
  definition.input.parse(definition.defaults, 'config.defaults');
  return Object.freeze({
    ...definition,
    defaults: structuredClone(definition.defaults),
    ui: definition.ui ? Object.freeze({ ...definition.ui }) : undefined,
  });
}

export function createGameConfigurationState(
  definition: GameConfigurationShape<object> | undefined,
  players: readonly PlayerStateEntity[],
  preferredOwnerId: number | null | undefined,
): GameConfigurationState {
  const ownerPlayerId = selectOwner(players, preferredOwnerId);
  return {
    ownerPlayerId,
    complete: definition == null,
    values: structuredClone(
      (definition?.defaults ?? {}) as Record<string, unknown>,
    ),
  };
}

export class GameConfigurationController {
  constructor(private readonly state: GameConfigurationState) {}

  isComplete(): boolean {
    return this.state.complete;
  }

  owner(): number | null {
    return this.state.ownerPlayerId;
  }

  values<TConfig extends object = Record<string, unknown>>(): TConfig {
    return structuredClone(this.state.values) as TConfig;
  }

  get<TValue>(key: string): TValue | null {
    const value = this.state.values[key];
    return value === undefined ? null : (structuredClone(value) as TValue);
  }
}

export function canConfigureGame<TState extends object>(
  definition: GameConfigurationShape<TState>,
  state: GameConfigurationState,
  actor: PlayerStateEntity,
  ctx: GameContext<TState>,
): boolean {
  if (state.complete) return false;
  if (definition.phase && ctx.phase() !== definition.phase) return false;
  if (
    (definition.permission ?? 'owner') === 'owner' &&
    actor.id !== state.ownerPlayerId
  ) {
    return false;
  }
  return true;
}

export function parseGameConfiguration<TState extends object>(
  definition: GameConfigurationShape<TState>,
  state: GameConfigurationState,
  input: unknown,
): object {
  const overrides = asConfigurationRecord(input);
  return definition.input.parse(
    { ...state.values, ...overrides },
    'config',
  );
}

export function commitGameConfiguration(
  state: GameConfigurationState,
  config: object,
): void {
  state.values = structuredClone(config as Record<string, unknown>);
  state.complete = true;
}

function selectOwner(
  players: readonly PlayerStateEntity[],
  preferredOwnerId: number | null | undefined,
): number | null {
  if (
    preferredOwnerId != null &&
    players.some((player) => player.id === preferredOwnerId)
  ) {
    return preferredOwnerId;
  }
  return players.find((player) => !player.isBot)?.id ?? players[0]?.id ?? null;
}

function asConfigurationRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
