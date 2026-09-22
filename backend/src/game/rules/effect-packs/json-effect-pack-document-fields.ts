import type { RegisteredJsonEffectPack } from './json-effect-pack-registry';

type UnionToIntersection<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;

type EffectPackDocumentEntry<Pack> = Pack extends RegisteredJsonEffectPack
  ? {
      readonly [Key in Pack['documentKey']]?: Parameters<Pack['compile']>[0];
    }
  : never;

/** Open document contract derived from the deterministic extension registry. */
export type JsonEffectPackDocumentFields = UnionToIntersection<
  EffectPackDocumentEntry<RegisteredJsonEffectPack>
>;
