import type { EffectSource } from './effect-ir';
import type { GameContext } from '../definitions/game-author-context';
import type {
  GameInputDescriptor,
  GameInputSchema,
} from '../actions/game-input-schema';

export interface GameEffectResolverShape<TState extends object> {
  input: GameInputDescriptor;
  resolveRaw(input: RawGameEffectResolution<TState>): void;
}

export type RawGameEffectResolution<TState extends object> = {
  state: TState;
  actorPlayerId: number | null;
  source: EffectSource | null;
  targetPlayerIds: readonly number[];
  data: unknown;
  ctx: GameContext<TState>;
};

export interface GameEffectResolver<TState extends object, TData> {
  input: GameInputSchema<TData>;
  apply(input: {
    state: TState;
    actorPlayerId: number | null;
    source: EffectSource | null;
    targetPlayerIds: readonly number[];
    data: TData;
    ctx: GameContext<TState>;
  }): void;
}

export type DefinedGameEffectResolver<
  TState extends object,
  TData,
> = GameEffectResolver<TState, TData> & GameEffectResolverShape<TState>;
