/** Data-only authoring entry, independent of Nest composition and TypeScript game builders. */
export { compileJsonGame } from '../runtime/definitions/json-game-compiler';
export { resolveJsonContent } from '../runtime/content/json-content-bundle';
export type { JsonContentAssets } from '../runtime/content/json-content-bundle';
export { jsonGameSchema } from '../runtime/definitions/json-game-schema';
export { effectJsonSchema } from '../runtime/contracts/effect-json-schema';

export { createJsonGameCompiler } from '../runtime/definitions/json-game-compiler-factory';
export { defineJsonEffectPack } from '../runtime/contracts/json-effect-pack';
export type { JsonEffectPackCatalog } from '../runtime/contracts/json-effect-pack-catalog';
