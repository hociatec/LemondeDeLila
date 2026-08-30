import type { PlayerStateEntity } from '../../../core/application/contracts/game-state.model';
import type { GameInputSchema } from '../actions/game-input-schema';
import type { GameContext } from '../game-rule-context';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

export const GAME_CONFIGURE_ACTION = 'game.configure' as const;

export type GameConfigurationState<
  TValues extends object = Record<string, unknown>,
> = {
  ownerPlayerId: number | null;
  complete: boolean;
  values: TValues;
};

export type GameConfigurationUi = {
  title?: string;
  description?: string;
  submitLabel?: string;
};

type GameConfigurationExecution<TState extends object> = {
  state: TState;
  actor: PlayerStateEntity;
  config: object;
  ctx: GameContext<TState>;
};

export interface GameConfigurationShape<
  TState extends object,
  TConfig extends object = object,
> {
  input: GameInputSchema<TConfig>;
  defaults: TConfig;
  phase?: string;
  permission?: 'owner' | 'any-player';
  ui?: GameConfigurationUi;
  /** Keys intentionally replacing configuration supplied by patterns. */
  overrides?: readonly string[];
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

export interface GameConfigurationDefinition<
  TState extends object,
  TConfig extends object,
> {
  input: GameInputSchema<TConfig>;
  defaults: TConfig;
  phase?: string;
  permission?: 'owner' | 'any-player';
  ui?: GameConfigurationUi;
  overrides?: readonly (keyof TConfig & string)[];
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
    overrides: definition.overrides
      ? Object.freeze([...definition.overrides])
      : undefined,
    ui: definition.ui ? Object.freeze({ ...definition.ui }) : undefined,
  });
}

export function overrideConfiguration<
  TState extends object,
  TConfig extends object,
>(
  keys: readonly (keyof TConfig & string)[],
  definition: GameConfigurationDefinition<TState, TConfig>,
): GameConfigurationDefinition<TState, TConfig> {
  return defineConfiguration({ ...definition, overrides: [...keys] });
}

export function composeGameConfigurations<TState extends object>(
  inherited: GameConfigurationShape<TState> | undefined,
  local: GameConfigurationShape<TState> | undefined,
): GameConfigurationShape<TState> | undefined {
  if (!inherited) return local;
  if (!local) return inherited;
  const inheritedKeys = configurationKeys(inherited);
  const overrides = new Set(local.overrides ?? []);
  for (const key of configurationKeys(local)) {
    if (inheritedKeys.has(key) && !overrides.has(key)) {
      throw new GameConfigurationError(
        `Configuration dupliquée « ${key} » sans overrideConfiguration() explicite`,
      );
    }
  }
  if (inherited.phase && local.phase && inherited.phase !== local.phase) {
    throw new GameConfigurationError('Phases de configuration incompatibles');
  }
  return Object.freeze({
    input: composeConfigurationInputs(inherited.input, local.input),
    defaults: Object.freeze({ ...inherited.defaults, ...local.defaults }),
    phase: local.phase ?? inherited.phase,
    permission: local.permission ?? inherited.permission,
    ui: Object.freeze({ ...(inherited.ui ?? {}), ...(local.ui ?? {}) }),
    validate: (input: GameConfigurationExecution<TState>) =>
      (inherited.validate?.(input) ?? true) &&
      (local.validate?.(input) ?? true),
    onConfigured: (input: GameConfigurationExecution<TState>) => {
      inherited.onConfigured?.(input);
      local.onConfigured?.(input);
    },
  });
}

function configurationKeys<TState extends object>(
  definition: GameConfigurationShape<TState>,
): Set<string> {
  const properties = definition.input.describe()['properties'];
  return new Set(
    properties && typeof properties === 'object'
      ? Object.keys(properties)
      : Object.keys(definition.defaults),
  );
}

function composeConfigurationInputs(
  inherited: GameInputSchema<object>,
  local: GameInputSchema<object>,
): GameInputSchema<object> {
  return {
    parse: (value, path = 'config') => ({
      ...inherited.parse(value, path),
      ...local.parse(value, path),
    }),
    describe: () => ({
      type: 'object',
      properties: {
        ...asRecord(inherited.describe()['properties']),
        ...asRecord(local.describe()['properties']),
      },
    }),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
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
    values: plainConfigurationValues(definition?.defaults ?? {}),
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

export type ConfigurationValuesOf<TDefinition> = TDefinition extends {
  readonly config?: { readonly defaults: infer TConfig extends object };
}
  ? TConfig
  : Record<string, never>;

export function canConfigureGame<TState extends object>(
  definition: GameConfigurationShape<TState>,
  state: GameConfigurationState,
  actor: PlayerStateEntity,
  ctx: GameContext<TState>,
): boolean {
  if (state.complete) return false;
  if (definition.phase && ctx.phase.current() !== definition.phase)
    return false;
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
  return definition.input.parse({ ...state.values, ...overrides }, 'config');
}

export function commitGameConfiguration(
  state: GameConfigurationState,
  config: object,
): void {
  state.values = plainConfigurationValues(config);
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

function plainConfigurationValues(value: object): Record<string, unknown> {
  return { ...(structuredClone(value) as Record<string, unknown>) };
}
