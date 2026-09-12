import { jsonEffectPacks } from './json-effect-pack-registry';

/** Schemas are contributed by their extension and composed in stable order. */
export const jsonEffectPackSchemas = Object.freeze(
  Object.fromEntries(
    jsonEffectPacks.map((extension) => [
      extension.documentKey,
      extension.schema,
    ]),
  ),
);
