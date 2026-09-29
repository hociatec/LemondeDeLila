import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
type Failure = (path: string, reason: string) => never;
export function assertBidirectionalCollisionRaceReferences(
  pattern: Extract<JsonGamePattern, { kind: 'bidirectional-collision-race' }>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}]`;
  const track = components.find(
    (item) =>
      item.component === 'movement.track' && item.id === pattern.trackId,
  );
  if (track?.component !== 'movement.track')
    fail(`${root}.trackId`, 'unknown track');
  if (
    track?.component === 'movement.track' &&
    track.spaces !== pattern.tiles.length
  )
    fail(`${root}.tiles`, 'one tile per track position required');
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
      fail(`${root}.${field}`, `unknown ${component} ${pattern[field]}`);
  if (!resources.has(pattern.appleResource))
    fail(`${root}.appleResource`, `unknown resource ${pattern.appleResource}`);
  for (const [index, tile] of pattern.tiles.entries())
    if (tile.n !== index + 1)
      fail(`${root}.tiles[${index}].n`, 'invalid tile order');
  if (pattern.tiles[0]?.type !== 'start')
    fail(`${root}.tiles[0].type`, 'start tile required');
  if (pattern.tiles.at(-1)?.type !== 'finish')
    fail(
      `${root}.tiles[${pattern.tiles.length - 1}].type`,
      'finish tile required',
    );
  const seen = new Set<number>();
  for (const [index, card] of pattern.cards.entries()) {
    if (seen.has(card.id))
      fail(`${root}.cards[${index}].id`, 'duplicate value');
    seen.add(card.id);
  }
}
