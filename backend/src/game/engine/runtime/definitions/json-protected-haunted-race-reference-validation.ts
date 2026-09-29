import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
type Failure = (path: string, reason: string) => never;
export function assertProtectedHauntedRaceReferences(
  pattern: Extract<JsonGamePattern, { kind: 'protected-haunted-race' }>,
  index: number,
  components: readonly GameComponentDefinition[],
  fail: Failure,
): void {
  const root = `patterns[${index}]`;
  const statuses = new Set<string>();
  for (const [i, rule] of pattern.protections.entries()) {
    if (!pattern.cards.some((card) => card.category === rule.category))
      fail(`${root}.protections[${i}].category`, 'unknown protected category');
    if (statuses.has(rule.status))
      fail(`${root}.protections[${i}].status`, 'duplicate value');
    statuses.add(rule.status);
  }
  const track = components.find(
    (item) =>
      item.component === 'movement.track' && item.id === pattern.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== pattern.tiles.length
  )
    fail(`${root}.trackId`, 'one tile per track position required');
  for (const [component, field] of [
    ['dice.set', 'diceId'],
    ['cards.deck', 'deckId'],
    ['pawn.set', 'pawnSetId'],
  ] as const)
    if (
      !components.some(
        (item) => item.component === component && item.id === pattern[field],
      )
    )
      fail(`${root}.${field}`, `unknown ${component}`);
  for (const [i, tile] of pattern.tiles.entries())
    if (tile.n !== i + 1) fail(`${root}.tiles[${i}].n`, 'invalid tile order');
  if (pattern.tiles.at(-1)?.type !== 'finish')
    fail(
      `${root}.tiles[${pattern.tiles.length - 1}].type`,
      'last tile must finish',
    );
  const cards = new Set<number>();
  for (const [i, card] of pattern.cards.entries()) {
    if (cards.has(card.id)) fail(`${root}.cards[${i}].id`, 'duplicate value');
    cards.add(card.id);
  }
}
