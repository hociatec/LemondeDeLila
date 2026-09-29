import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
import { authoringProperty } from '../contracts/authoring-diagnostics';

type Failure = (path: string, reason: string) => never;

export function assertTreasureTrackReferences(
  pattern: Extract<JsonGamePattern, { kind: 'treasure-track-race' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  const track = components.find(
    (component) =>
      component.component === 'movement.track' &&
      component.id === pattern.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== pattern.tiles.length
  )
    fail(`${root}.trackId`, 'one tile per track position required');
  if (
    !components.some(
      (component) =>
        component.component === 'dice.set' && component.id === pattern.diceId,
    )
  )
    fail(`${root}.diceId`, 'unknown dice');
  for (const [key, deckId] of Object.entries(pattern.decks))
    if (
      !components.some(
        (component) =>
          component.component === 'cards.deck' && component.id === deckId,
      )
    )
      fail(
        `${root}.${authoringProperty('decks', key)}`,
        `unknown deck ${deckId}`,
      );
  for (const [key, inventoryId] of Object.entries(pattern.inventories))
    if (
      !components.some(
        (component) =>
          component.component === 'inventory.set' &&
          component.id === inventoryId,
      )
    )
      fail(
        `${root}.${authoringProperty('inventories', key)}`,
        `unknown inventory ${inventoryId}`,
      );
  for (const [index, tile] of pattern.tiles.entries())
    if (!pattern.tileRules[tile.type])
      fail(`${root}.tiles[${index}].type`, 'unknown tile rule');
  for (const [key, rule] of Object.entries(pattern.tileRules))
    if (rule.kind === 'draw' && (!rule.deck || !pattern.decks[rule.deck]))
      fail(
        `${root}.${authoringProperty('tileRules', key)}.deck`,
        'unknown draw deck',
      );
  for (const key of Object.keys(pattern.decks))
    if (!pattern.inventories[key] || !pattern.deckRules[key])
      fail(
        `${root}.${authoringProperty(
          !pattern.inventories[key] ? 'inventories' : 'deckRules',
          key,
        )}`,
        'missing deck inventory or rule',
      );
  if (!pattern.inventories[pattern.victoryCollection])
    fail(`${root}.victoryCollection`, 'unknown victory collection');
  if (!resources.has(pattern.goldResource))
    fail(`${root}.goldResource`, 'unknown gold resource');
  if (pattern.requiredTreasures > pattern.collectionLimit)
    fail(
      `${root}.requiredTreasures`,
      'required treasures exceed collection limit',
    );
}
