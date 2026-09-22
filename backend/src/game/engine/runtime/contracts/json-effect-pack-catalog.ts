import type { JsonEffectPackDefinition } from './json-effect-pack';

/** Only the extension protocol is visible to the engine, never its catalogue. */
export type JsonEffectPackCatalog = readonly Pick<
  JsonEffectPackDefinition<string, unknown, string, unknown>,
  | 'documentKey'
  | 'outputKey'
  | 'schema'
  | 'compileUnknown'
  | 'collectActions'
  | 'collectEvents'
  | 'collectComponents'
  | 'collectPatterns'
  | 'collectHandlers'
  | 'collectChoiceIds'
  | 'validateUnknown'
  | 'victoryKind'
  | 'victoryLabel'
  | 'ownsSetup'
>[];
