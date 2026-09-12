export type GameEffectValidationReferences = {
  /** Available only when validating a persisted session, not static content. */
  readonly playerIds?: ReadonlySet<number>;
  readonly decks: ReadonlyMap<string, unknown>;
  readonly hands: ReadonlyMap<string, unknown>;
  readonly inventories: ReadonlyMap<string, unknown>;
  readonly tracks: ReadonlySet<string>;
  readonly diceSets: ReadonlySet<string>;
  readonly effects?: Readonly<Record<string, unknown>>;
  readonly handDecks?: ReadonlyMap<string, string>;
  readonly handAcceptedDecks?: ReadonlyMap<string, ReadonlySet<string>>;
  readonly cardIdsByDeck?: ReadonlyMap<string, ReadonlySet<string>>;
  readonly trackSpaces?: ReadonlyMap<string, number>;
  readonly resources?: ReadonlySet<string>;
  readonly inventoryItems?: ReadonlyMap<string, ReadonlySet<string> | null>;
  readonly ownershipAssets?: ReadonlyMap<string, ReadonlySet<string>>;
};

export type ValidationFailure = (path: string, reason: string) => never;
