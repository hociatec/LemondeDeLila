import type { JsonGameCoreDocument } from './json-game-core-document';
/** Extension fields are validated against the supplied catalogue. */
export type JsonGameDocument = JsonGameCoreDocument &
  Readonly<Record<string, unknown>>;
