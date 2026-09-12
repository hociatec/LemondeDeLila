import type { CarAssemblyProgram } from '../contracts/car-assembly-program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
} from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

const text = { type: 'string', minLength: 1, maxLength: 4000 } as const;
export const jsonCarAssemblySchema = object({
  deckId: id,
  handId: id,
  currentInventoryId: id,
  completedInventoryIds: array(id, 1),
  completedNameResources: array(id, 1),
  completedCountResource: id,
  carNameCounter: id,
  cards: array(object({ id, name: text, category: id }), 1),
  categoryOrder: array(id, 1),
  carNames: array(object({ name: text, description: text }), 1),
  carsToWin: positive,
  finishReason: id,
  eventNamespace: id,
});

export function assertCarAssemblyReferences(
  program: CarAssemblyProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  counters: ReadonlySet<string>,
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Car assembly: ${reason}`);
  };
  const component = (kind: GameComponentDefinition['component'], id: string) =>
    components.find(
      (candidate) => candidate.component === kind && candidate.id === id,
    );
  const hand = component('cards.hands', program.handId);
  if (!component('cards.deck', program.deckId)) fail('unknown deck');
  if (hand?.component !== 'cards.hands' || hand.deck !== program.deckId)
    fail('unknown hand or mismatched deck');
  for (const inventory of [
    program.currentInventoryId,
    ...program.completedInventoryIds,
  ])
    if (!component('inventory.set', inventory))
      fail(`unknown inventory ${inventory}`);
  if (
    program.completedInventoryIds.length < program.carsToWin ||
    program.completedNameResources.length < program.carsToWin
  )
    fail('one completed slot and name resource required per winning car');
  for (const resource of [
    program.completedCountResource,
    ...program.completedNameResources,
  ])
    if (!resources.has(resource)) fail(`unknown resource ${resource}`);
  if (!counters.has(program.carNameCounter)) fail('unknown car name counter');
  if (new Set(program.categoryOrder).size !== program.categoryOrder.length)
    fail('duplicate category');
  for (const category of program.categoryOrder)
    if (!program.cards.some((card) => card.category === category))
      fail(`category without cards ${category}`);
  if (
    new Set(program.cards.map((card) => card.id)).size !== program.cards.length
  )
    fail('duplicate card id');
}
