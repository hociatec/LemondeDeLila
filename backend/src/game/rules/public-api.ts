/** Application-owned catalogue; existing game JSON keeps its wire format. */
import { createJsonGameCompiler } from '../engine/sdk/extension-api';
import type { JsonGameCoreDocument } from '../engine/sdk/extension-api';
import type { JsonEffectPackDocumentFields } from './effect-packs/json-effect-pack-document-fields';
import { jsonEffectPacks } from './effect-packs/json-effect-pack-registry';
import type {
  JsonEffectPackViews,
  JsonGameViewAugmentation,
} from '../engine/sdk/extension-api';

export type JsonGameViews = JsonEffectPackViews<typeof jsonEffectPacks>;
export type JsonGameView = JsonGameViewAugmentation<typeof jsonEffectPacks>;

const compiler = createJsonGameCompiler(jsonEffectPacks);
export type JsonGameDocument = JsonGameCoreDocument &
  JsonEffectPackDocumentFields;
export const compileJsonGame = compiler.compileJsonGame;
export const jsonGameSchema = compiler.jsonGameSchema;
export const parseJsonGame = (
  value: unknown,
  path?: string,
): JsonGameDocument => compiler.parseJsonGame(value, path);
export { resolveJsonContent } from '../engine/sdk/extension-api';
export type { JsonContentAssets } from '../engine/sdk/extension-api';
export type { JsonGameManifest } from '../engine/sdk/extension-api';
export { effectJsonSchema } from '../engine/sdk/extension-api';
