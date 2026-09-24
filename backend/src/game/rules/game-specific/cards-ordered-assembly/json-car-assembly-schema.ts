import { assertUniqueAuthorIds } from '../../../engine/sdk/extension-api';
import {
  authoringFailure,
  assertUniqueAuthorValues,
} from '../../../engine/sdk/extension-api';
import type { CarAssemblyProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
} from '../../../engine/sdk/extension-api';

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
  const fail = authoringFailure('game.json.carAssembly', program);
  const component = (kind: GameComponentDefinition['component'], id: string) =>
    components.find(
      (candidate) => candidate.component === kind && candidate.id === id,
    );
  const hand = component('cards.hands', program.handId);
  if (!component('cards.deck', program.deckId)) fail('deckId', 'unknown deck');
  if (hand?.component !== 'cards.hands' || hand.deck !== program.deckId)
    fail('handId', 'unknown hand or mismatched deck');
  for (const [field, inventory] of [
    ['currentInventoryId', program.currentInventoryId],
    ...program.completedInventoryIds.map((id, i) => [
      `completedInventoryIds[${i}]`,
      id,
    ]),
  ])
    if (!component('inventory.set', inventory))
      fail(field, `unknown inventory ${inventory}`);
  for (const field of [
    'completedInventoryIds',
    'completedNameResources',
  ] as const)
    if (program[field].length < program.carsToWin)
      fail(
        field,
        'one completed slot and name resource required per winning car',
      );
  for (const [field, resource] of [
    ['completedCountResource', program.completedCountResource],
    ...program.completedNameResources.map((id, i) => [
      `completedNameResources[${i}]`,
      id,
    ]),
  ])
    if (!resources.has(resource)) fail(field, `unknown resource ${resource}`);
  if (!counters.has(program.carNameCounter))
    fail('carNameCounter', 'unknown car name counter');
  assertUniqueAuthorValues(
    program.categoryOrder,
    (i) => `categoryOrder[${i}]`,
    fail,
  );
  for (const [index, category] of program.categoryOrder.entries())
    if (!program.cards.some((card) => card.category === category))
      fail(`categoryOrder[${index}]`, `category without cards ${category}`);
  assertUniqueAuthorIds(program.cards, 'cards', fail);
}
