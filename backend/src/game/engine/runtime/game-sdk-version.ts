export const GAME_SDK_VERSION = '2.1' as const;

export const GAME_STATE_MUTATION_POLICY = Object.freeze({
  gameState: 'mutate-callback-state',
  engineState: 'game-context-only',
  callbackReturn: 'void',
});
