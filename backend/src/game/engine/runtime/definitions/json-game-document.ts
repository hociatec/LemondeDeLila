import type { JsonProgramExtensions } from '../extensions/json-program-extension-contract';
import type { JsonGameCoreDocument } from './json-game-core-document';

export type JsonGameDocument = JsonGameCoreDocument & JsonProgramExtensions;
