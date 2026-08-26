export const GAME_SDK_VERSION = '2' as const;

export const GAME_STATE_MUTATION_POLICY = Object.freeze({
  gameState: 'mutate-callback-state',
  engineState: 'game-context-only',
  callbackReturn: 'void',
});

export type GameSdkDeprecation = {
  readonly deprecatedIn: typeof GAME_SDK_VERSION;
  readonly removeIn: '3';
  readonly replacement: string;
};

/**
 * Exhaustive removal schedule for SDK compatibility paths. A compatibility
 * branch may not be introduced without an entry here and an exact target
 * version, which keeps migrations short and reviewable.
 */
export const GAME_SDK_DEPRECATIONS = Object.freeze({
  'persisted.engine.version': Object.freeze({
    deprecatedIn: '2',
    removeIn: '3',
    replacement: 'engine.schemaVersion and definition.stateVersion',
  }),
  'persisted.quiz.banks': Object.freeze({
    deprecatedIn: '2',
    removeIn: '3',
    replacement: 'definition.components with quiz.bank',
  }),
} satisfies Readonly<Record<string, GameSdkDeprecation>>);
