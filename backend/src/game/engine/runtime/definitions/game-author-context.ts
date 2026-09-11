import type { GameContextCapabilities } from './game-context-capabilities';
export type { PublicController } from './game-context-capabilities';

/** Author contract is independent of runtime constructors and orchestration. */
export type GameContext<TState extends object> =
  GameContextCapabilities<TState>;
