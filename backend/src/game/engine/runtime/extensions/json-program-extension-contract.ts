import type { RegisteredJsonProgramExtension } from './json-program-extension-registry';

type UnionToIntersection<Union> = (
  Union extends unknown ? (value: Union) => void : never
) extends (value: infer Intersection) => void
  ? Intersection
  : never;

type ExtensionDocumentEntry<Extension> =
  Extension extends RegisteredJsonProgramExtension
    ? {
        readonly [Key in Extension['documentKey']]?: Parameters<
          Extension['compile']
        >[0];
      }
    : never;

/** Open document contract derived from the deterministic extension registry. */
export type JsonProgramExtensions = UnionToIntersection<
  ExtensionDocumentEntry<RegisteredJsonProgramExtension>
>;
