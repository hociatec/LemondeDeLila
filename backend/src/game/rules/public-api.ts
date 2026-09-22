/** Application-owned catalogue; existing game JSON keeps its wire format. */
import { createJsonGameCompiler } from '../engine/runtime/definitions/json-game-compiler-factory';
import type { JsonGameCoreDocument } from '../engine/runtime/definitions/json-game-core-document';
import type { JsonEffectPackDocumentFields } from './effect-packs/json-effect-pack-document-fields';
import { jsonEffectPacks } from './effect-packs/json-effect-pack-registry';

const compiler = createJsonGameCompiler(jsonEffectPacks);
export type JsonGameDocument = JsonGameCoreDocument &
  JsonEffectPackDocumentFields;
export const compileJsonGame = compiler.compileJsonGame;
export const jsonGameSchema = compiler.jsonGameSchema;
export const parseJsonGame = (
  value: unknown,
  path?: string,
): JsonGameDocument => compiler.parseJsonGame(value, path);
export { resolveJsonContent } from '../engine/runtime/content/json-content-bundle';
export type { JsonContentAssets } from '../engine/runtime/content/json-content-bundle';
export type { JsonGameManifest } from '../engine/runtime/definitions/json-game-manifest';
export { effectJsonSchema } from '../engine/runtime/contracts/effect-json-schema';
