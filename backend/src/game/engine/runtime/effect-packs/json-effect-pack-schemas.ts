import type { JsonEffectPackCatalog } from '../contracts/json-effect-pack-catalog';
export const effectPackSchemas = (packs: JsonEffectPackCatalog) =>
  Object.freeze(
    Object.fromEntries(packs.map((pack) => [pack.documentKey, pack.schema])),
  );
