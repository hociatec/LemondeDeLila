import type {
  GameComponentDefinition,
  GameInitialization,
} from './component-kit';
import type { ValidationFailure } from '../contracts/definition-validation';

type ComponentOf<Kind extends GameComponentDefinition['component']> = Extract<
  GameComponentDefinition,
  { component: Kind }
>;

export function assertInitializationReferences(
  components: readonly GameComponentDefinition[],
  initialization: GameInitialization | undefined,
  fail: ValidationFailure,
): void {
  const references = initializationReferences(components);
  assertTrackReferences(components, initialization, references.tracks, fail);
  assertPawnReferences(initialization, references.pawns, fail);
  assertDealReferences(initialization, references, fail);
  assertGridReferences(initialization, references.grids, fail);
  assertCollectionReferences(components, references.inventories, fail);
}

function initializationReferences(
  components: readonly GameComponentDefinition[],
) {
  const ids = (kind: GameComponentDefinition['component']) =>
    new Set(
      components
        .filter((value) => value.component === kind)
        .map((value) => value.id),
    );
  const definitions = <Kind extends GameComponentDefinition['component']>(
    kind: Kind,
  ) =>
    new Map(
      components
        .filter((value): value is ComponentOf<Kind> => value.component === kind)
        .map((value) => [value.id, value]),
    );
  return {
    tracks: ids('movement.track'),
    pawns: ids('pawn.set'),
    inventories: ids('inventory.set'),
    decks: definitions('cards.deck'),
    hands: definitions('cards.hands'),
    grids: definitions('grid.board'),
  };
}

function assertTrackReferences(
  components: readonly GameComponentDefinition[],
  initialization: GameInitialization | undefined,
  tracks: ReadonlySet<string>,
  fail: ValidationFailure,
): void {
  for (const [id, positions] of Object.entries(initialization?.tracks ?? {})) {
    if (!tracks.has(id)) fail(`initialization.tracks.${id}`, 'piste inconnue');
    const track = components.find(
      (value) => value.component === 'movement.track' && value.id === id,
    );
    if (track?.component !== 'movement.track') continue;
    for (const position of typeof positions === 'number'
      ? [positions]
      : Object.values(positions)) {
      if (
        !Number.isSafeInteger(position) ||
        position < 0 ||
        position >= track.spaces
      )
        fail(`initialization.tracks.${id}`, 'case inexistante');
    }
  }
}

function assertPawnReferences(
  initialization: GameInitialization | undefined,
  pawns: ReadonlySet<string>,
  fail: ValidationFailure,
): void {
  const initialized = new Set<string>();
  for (const pawn of initialization?.pawns ?? []) {
    if (!pawns.has(pawn.setId))
      fail(`initialization.pawns.${pawn.setId}`, 'ensemble de pions inconnu');
    if (initialized.has(pawn.setId))
      fail(`initialization.pawns.${pawn.setId}`, 'attribution répétée');
    initialized.add(pawn.setId);
    if (
      pawn.assignment !== undefined &&
      !['round-robin', 'grouped', 'random'].includes(pawn.assignment)
    )
      fail(`initialization.pawns.${pawn.setId}`, 'mode inconnu');
  }
}

function assertDealReferences(
  initialization: GameInitialization | undefined,
  references: ReturnType<typeof initializationReferences>,
  fail: ValidationFailure,
): void {
  for (const [index, deal] of (initialization?.deals ?? []).entries()) {
    const path = `initialization.deals.${index}`;
    const hand = references.hands.get(deal.handId);
    if (!references.decks.has(deal.deckId))
      fail(`${path}.deckId`, 'pioche inconnue');
    if (deal.fallbackDeckId && !references.decks.has(deal.fallbackDeckId))
      fail(`${path}.fallbackDeckId`, 'pioche de repli inconnue');
    if (!hand) fail(`${path}.handId`, 'main inconnue');
    const accepted = new Set(
      hand?.component === 'cards.hands'
        ? [hand.deck, ...(hand.acceptedDecks ?? [])]
        : [],
    );
    if (!accepted.has(deal.deckId))
      fail(path, 'la main refuse la pioche source');
    if (deal.fallbackDeckId && !accepted.has(deal.fallbackDeckId))
      fail(path, 'la main refuse la pioche de repli');
  }
}

function assertGridReferences(
  initialization: GameInitialization | undefined,
  grids: ReturnType<typeof initializationReferences>['grids'],
  fail: ValidationFailure,
): void {
  const initialized = new Set<string>();
  for (const placement of initialization?.gridPlacements ?? []) {
    const path = `initialization.gridPlacements.${placement.boardId}`;
    const board = grids.get(placement.boardId);
    if (!board || board.component !== 'grid.board')
      fail(path, 'grille inconnue');
    if (initialized.has(placement.boardId))
      fail(path, 'placement de grille répété');
    initialized.add(placement.boardId);
    if (
      board?.component === 'grid.board' &&
      placement.positions.some(
        ({ x, y }) => x < 0 || y < 0 || x >= board.width || y >= board.height,
      )
    )
      fail(path, 'position hors grille');
  }
}

function assertCollectionReferences(
  components: readonly GameComponentDefinition[],
  inventories: ReadonlySet<string>,
  fail: ValidationFailure,
): void {
  for (const component of components) {
    if (component.component !== 'collection.view') continue;
    const sources = [
      ...Object.values(component.groups),
      ...(component.total && component.total !== 'sum'
        ? [component.total]
        : []),
    ];
    for (const source of sources) {
      if (source.kind === 'inventory' && !inventories.has(source.id))
        fail(`components.${component.id}`, `inventaire inconnu: ${source.id}`);
    }
  }
}
