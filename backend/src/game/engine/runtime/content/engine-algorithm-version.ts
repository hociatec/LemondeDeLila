/** Bump only when deterministic engine semantics change incompatibly. */
// Version 2: has-card compares object cards by their persistent identifier.
// A version-1 continuation could otherwise take a different conditional branch.
export const GAME_ENGINE_ALGORITHM_VERSION = '2' as const;
