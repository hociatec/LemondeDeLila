import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';

type Failure = (path: string, reason: string) => never;

export function assertOrderedAssemblyReferences(
  pattern: Extract<JsonGamePattern, { kind: 'ordered-assembly' }>,
  index: number,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  counters: ReadonlySet<string>,
  fail: Failure,
): void {
  const root = `patterns[${index}]`;
  const component = (kind: GameComponentDefinition['component'], id: string) =>
    components.find((item) => item.component === kind && item.id === id);
  const hand = component('cards.hands', pattern.handId);
  if (!component('cards.deck', pattern.deckId))
    fail(`${root}.deckId`, 'unknown deck');
  if (hand?.component !== 'cards.hands' || hand.deck !== pattern.deckId)
    fail(`${root}.handId`, 'unknown hand or mismatched deck');
  for (const [field, inventory] of [
    ['currentInventoryId', pattern.currentInventoryId],
    ...pattern.completedInventoryIds.map((id, slot) => [
      `completedInventoryIds[${slot}]`,
      id,
    ]),
  ])
    if (!component('inventory.set', inventory))
      fail(`${root}.${field}`, `unknown inventory ${inventory}`);
  if (pattern.completedInventoryIds.length < pattern.setsToWin)
    fail(`${root}.completedInventoryIds`, 'one slot required per winning set');
  if (pattern.completedNameResources.length < pattern.setsToWin)
    fail(`${root}.completedNameResources`, 'one name required per winning set');
  for (const [field, resource] of [
    ['completedCountResource', pattern.completedCountResource],
    ...pattern.completedNameResources.map((id, slot) => [
      `completedNameResources[${slot}]`,
      id,
    ]),
  ])
    if (!resources.has(resource))
      fail(`${root}.${field}`, `unknown resource ${resource}`);
  if (!counters.has(pattern.nameCounter))
    fail(`${root}.nameCounter`, 'unknown counter');
  if (new Set(pattern.categoryOrder).size !== pattern.categoryOrder.length)
    fail(`${root}.categoryOrder`, 'duplicate category');
  if (
    new Set(pattern.cards.map((card) => card.id)).size !== pattern.cards.length
  )
    fail(`${root}.cards`, 'duplicate card');
  for (const [slot, category] of pattern.categoryOrder.entries())
    if (!pattern.cards.some((card) => card.category === category))
      fail(`${root}.categoryOrder[${slot}]`, 'category without cards');
}
