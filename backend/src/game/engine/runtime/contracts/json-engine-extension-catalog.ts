import type { JsonEngineExtensionDefinition } from './json-engine-extension';

/** Only the extension protocol is visible to the engine, never its catalogue. */
export type JsonEngineExtensionCatalog = readonly Pick<
  JsonEngineExtensionDefinition<string, unknown, string, unknown>,
  | 'documentKey'
  | 'outputKey'
  | 'schema'
  | 'compileContribution'
  | 'collectChoiceIds'
  | 'validateUnknown'
  | 'victoryKind'
  | 'victoryRequired'
  | 'victoryLabel'
  | 'ownsSetup'
>[];

type ExtensionView<Extension extends JsonEngineExtensionCatalog[number]> =
  ReturnType<
    NonNullable<
      ReturnType<
        ReturnType<Extension['compileContribution']>['handlers']
      >['viewExtension']
    >
  >;
type UnionKeys<Value> = Value extends object ? keyof Value : never;
type UnionValue<Value, Key extends PropertyKey> = Value extends object
  ? Key extends keyof Value
    ? Value[Key]
    : never
  : never;

/** Optional fields reflect the subset of extensions enabled by each document. */
export type JsonGameViewAugmentation<
  Catalog extends JsonEngineExtensionCatalog,
> = {
  readonly [Key in UnionKeys<ExtensionView<Catalog[number]>>]?: UnionValue<
    ExtensionView<Catalog[number]>,
    Key
  >;
};

/** Consumers that know the extension can select its exact view contract. */
export type JsonEngineExtensionViews<
  Catalog extends JsonEngineExtensionCatalog,
> = {
  readonly [
    Extension in Catalog[number] as Extension['documentKey']
  ]: ExtensionView<Extension>;
};
