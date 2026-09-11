export type GameEffectValidationReferences = {
  readonly decks: ReadonlyMap<string, unknown>;
  readonly hands: ReadonlyMap<string, unknown>;
  readonly inventories: ReadonlyMap<string, unknown>;
  readonly tracks: ReadonlySet<string>;
  readonly diceSets: ReadonlySet<string>;
  readonly effects?: Readonly<Record<string, unknown>>;
  readonly handDecks?: ReadonlyMap<string, string>;
  readonly cardIdsByDeck?: ReadonlyMap<string, ReadonlySet<string>>;
  readonly trackSpaces?: ReadonlyMap<string, number>;
  readonly resources?: ReadonlySet<string>;
};

export type ValidationFailure = (path: string, reason: string) => never;
