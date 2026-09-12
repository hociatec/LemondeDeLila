import type { JsonEffectPackDocumentFields } from '../effect-packs/json-effect-pack-document-fields';
import type { JsonGameCoreDocument } from './json-game-core-document';

export type JsonGameDocument = JsonGameCoreDocument &
  JsonEffectPackDocumentFields;
