import type { JsonEffectPackDefinition } from './json-effect-pack';

/** Only the extension protocol is visible to the engine, never its catalogue. */
export type JsonEffectPackCatalog = readonly Pick<
  JsonEffectPackDefinition<string, unknown, string, unknown>,
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

type PackView<Pack extends JsonEffectPackCatalog[number]> = ReturnType<
  NonNullable<
    ReturnType<
      ReturnType<Pack['compileContribution']>['handlers']
    >['viewExtension']
  >
>;
type UnionKeys<Value> = Value extends object ? keyof Value : never;
type UnionValue<Value, Key extends PropertyKey> = Value extends object
  ? Key extends keyof Value
    ? Value[Key]
    : never
  : never;

/** Optional fields reflect the subset of packs enabled by each document. */
export type JsonGameViewAugmentation<Catalog extends JsonEffectPackCatalog> = {
  readonly [Key in UnionKeys<PackView<Catalog[number]>>]?: UnionValue<
    PackView<Catalog[number]>,
    Key
  >;
};

/** Consumers that know the extension can select its exact view contract. */
export type JsonEffectPackViews<Catalog extends JsonEffectPackCatalog> = {
  readonly [Pack in Catalog[number] as Pack['documentKey']]: PackView<Pack>;
};
