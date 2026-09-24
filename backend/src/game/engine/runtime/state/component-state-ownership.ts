import type { GameComponentDefinition } from '../definitions/component-kit';
import type { DeclarativeState, EngineKitsState } from './declarative-state';

/** Paths are checked against the persisted state: renaming storage breaks compilation. */
export type KitStateOwnershipId = {
  [
    Kit in keyof EngineKitsState
  ]-?: `kits.${Kit}.${keyof NonNullable<EngineKitsState[Kit]> & string}`;
}[keyof EngineKitsState];
type PlayerValues = DeclarativeState<object>['engine']['playerValues'];
export type StateOwnershipId =
  KitStateOwnershipId | `playerValues.${keyof PlayerValues}`;

const owned = <T extends StateOwnershipId>(id: T, ...authorAliases: string[]) =>
  Object.freeze({ id, authorAliases: Object.freeze(authorAliases) });
type Ownership = ReturnType<typeof owned>;

/** A component declares all storage it owns; collection.view owns no state. */
export const componentStateOwnership = Object.freeze({
  'resource.pool': Object.freeze([
    owned('playerValues.resources', 'resources'),
  ]),
  'movement.track': Object.freeze([
    owned(
      'kits.movement.positions',
      'position',
      'positions',
      'currentPosition',
    ),
  ]),
  'cards.deck': Object.freeze([
    owned('kits.cards.decks', 'deck', 'decks'),
    owned('kits.cards.discards', 'discard', 'discards'),
    owned('kits.cards.deckLifecycles', 'deckLifecycles'),
  ]),
  'cards.hands': Object.freeze([owned('kits.cards.hands', 'hand', 'hands')]),
  'cards.zone': Object.freeze([owned('kits.cards.zones', 'zone', 'zones')]),
  'cards.sets': Object.freeze([
    owned('kits.cards.completedSets', 'cardSets', 'completedSets'),
  ]),
  'inventory.set': Object.freeze([
    owned('kits.inventory.byPlayer', 'inventory', 'inventories'),
  ]),
  'economy.market': Object.freeze([
    owned('kits.economy.prices', 'marketStock', 'marketPrices'),
  ]),
  'ownership.registry': Object.freeze([
    owned('kits.ownership.owners', 'owners', 'ownership'),
  ]),
  'pawn.set': Object.freeze([
    owned('kits.pawns.positions', 'pawnPositions'),
    owned('kits.pawns.assignments', 'pawnAssignments'),
    owned('kits.pawns.owners', 'pawnOwners'),
  ]),
  'grid.board': Object.freeze([
    owned('kits.grid.cells', 'gridCells'),
    owned('kits.grid.overlays', 'gridOverlays'),
  ]),
  'quiz.bank': Object.freeze([
    owned('kits.quiz.sessions', 'quizSessions'),
    owned('kits.quiz.orders', 'quizOrders'),
    owned('kits.quiz.cursors', 'quizCursors'),
    owned('kits.quiz.sequence', 'quizSequence'),
  ]),
  'collection.view': Object.freeze([]),
  'dice.set': Object.freeze([
    owned('kits.dice.rolls', 'dice', 'lastRoll'),
    owned('kits.dice.rollsByPlayer', 'diceRollsByPlayer'),
    owned('kits.dice.lastRollId', 'lastRollId'),
    owned('kits.dice.sequence', 'diceSequence'),
  ]),
} satisfies Record<GameComponentDefinition['component'], readonly Ownership[]>);

export const coreStateOwnership = Object.freeze([
  owned('playerValues.resources', 'resources'),
  owned('playerValues.statuses', 'statuses'),
  owned('playerValues.counters', 'counters'),
  owned('playerValues.turnFlags', 'turnFlags'),
  owned('playerValues.scores', 'score', 'scores'),
  owned(
    'playerValues.scheduledSkips',
    'skipTurn',
    'skipTurns',
    'scheduledSkips',
  ),
  owned(
    'playerValues.scheduledExtraTurns',
    'extraTurn',
    'extraTurns',
    'scheduledExtraTurns',
  ),
]);
