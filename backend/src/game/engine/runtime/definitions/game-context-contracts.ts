import type { OptionalGameCapability } from '../contracts/compiled-game-plan';
import type { CompiledGameDefinition } from '../contracts/compiled-game-definition';
import type { GameActionMap } from '../contracts/author-rule-contracts';
import type { GameContext, PublicController } from './game-author-context';
export type {
  GameAuthorContextFacades,
  GameComponentsFacade,
  GameEffectsFacade,
  GameInteractionsFacade,
  GameLifecycleFacade,
  GamePlayersFacade,
  GameSchedulingFacade,
  GameValuesFacade,
} from './game-context-facades';
import type {
  GameResourcesController,
  GameCountersController,
} from '../kits/player-values-kit';

type ContextDefinitionInitialization<TDefinition> = TDefinition extends {
  readonly initialization?: infer TInitialization;
}
  ? TInitialization
  : never;
type ContextInitializations<TDefinition> =
  ContextDefinitionInitialization<TDefinition>;
type InitializedResourceIdOf<TDefinition> =
  ContextInitializations<TDefinition> extends infer TInitialization
    ? TInitialization extends { readonly resources?: infer TResources }
      ? string extends keyof NonNullable<TResources>
        ? string
        : Extract<keyof NonNullable<TResources>, string>
      : never
    : never;
export type GameResourceIdOf<TDefinition> =
  | InitializedResourceIdOf<TDefinition>
  | (TDefinition extends { readonly resourceIds?: infer TIds }
      ? TIds extends readonly string[]
        ? TIds[number]
        : never
      : never);
export type GameCounterIdOf<TDefinition> =
  ContextInitializations<TDefinition> extends infer TInitialization
    ? TInitialization extends { readonly counters?: infer TCounters }
      ? string extends keyof NonNullable<TCounters>
        ? string
        : Extract<keyof NonNullable<TCounters>, string>
      : never
    : never;
type GameStateOf<TDefinition> =
  TDefinition extends CompiledGameDefinition<
    infer TState,
    GameActionMap<infer TState>,
    object,
    infer _TInitialization,
    infer _TEvents,
    infer _TPatterns
  >
    ? TState
    : object;
export type GameContextFor<TDefinition> = Omit<
  GameContext<GameStateOf<TDefinition>>,
  'resources' | 'counters' | UnusedCapabilities<TDefinition>
> & {
  readonly resources: PublicController<
    GameResourcesController<GameResourceIdOf<TDefinition>>
  >;
  readonly counters: PublicController<
    GameCountersController<GameCounterIdOf<TDefinition>>
  >;
};

type UnusedCapabilities<TDefinition> = Exclude<
  OptionalGameCapability,
  TDefinition extends { readonly capabilities: readonly (infer C)[] }
    ? C
    : never
>;
