import type {
  GameEffectResolver,
  DefinedGameEffectResolver,
  RawGameEffectResolution,
} from '../contracts/effect-resolver';
export type {
  GameEffectResolverShape,
  GameEffectResolver,
  DefinedGameEffectResolver,
  RawGameEffectResolution,
} from '../contracts/effect-resolver';
import type { EffectEngineState } from '../contracts/effect-ir';
export type {
  EffectTarget,
  EffectCondition,
  EffectChoiceAvailability,
  GameEffectInstruction,
  EffectEngineState,
  EffectSource,
} from '../contracts/effect-ir';
import { typedRuntimeHandler } from '../actions/typed-runtime-handler';
export function defineEffect<TState extends object, TData>(
  resolver: GameEffectResolver<TState, TData>,
): DefinedGameEffectResolver<TState, TData> {
  resolver = { ...resolver };
  const runtimeHandler = typedRuntimeHandler<
    TData,
    Omit<RawGameEffectResolution<TState>, 'data'>
  >({
    schema: resolver.input,
    path: 'effect.data',
    handle: (execution, data) => resolver.apply({ ...execution, data }),
  });
  return Object.freeze({
    ...resolver,
    input: runtimeHandler.input,
    resolveRaw: ({ data, ...execution }: RawGameEffectResolution<TState>) =>
      runtimeHandler.handle(execution, data),
  });
}

export function createEffectEngineState(): EffectEngineState {
  return {
    schemaVersion: 1,
    queue: [],
    actorPlayerId: null,
    chosenPlayerId: null,
    awaitingChoiceId: null,
    awaitingReaction: null,
    awaitingPlayerChoice: null,
    playerChoiceResolved: false,
    resolvedPlayerChoiceId: null,
    completeTurnWhenDrained: false,
    source: null,
  };
}
