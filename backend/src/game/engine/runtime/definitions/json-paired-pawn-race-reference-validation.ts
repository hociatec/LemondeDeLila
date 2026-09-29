import { authoringProperty } from '../contracts/authoring-diagnostics';
import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
type Failure = (path: string, reason: string) => never;
export function assertPairedPawnRaceReferences(
  pattern: Extract<JsonGamePattern, { kind: 'paired-pawn-race' }>,
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
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== pattern.tiles.length
  )
    fail(`${root}.trackId`, 'one tile per track position required');
  if (
    !components.some(
      (item) => item.component === 'dice.set' && item.id === pattern.diceId,
    )
  )
    fail(`${root}.diceId`, 'unknown dice');
  if (
    !components.some(
      (item) => item.component === 'cards.deck' && item.id === pattern.deckId,
    )
  )
    fail(`${root}.deckId`, 'unknown deck');
  if (!resources.has(pattern.tokenResource))
    fail(`${root}.tokenResource`, 'unknown token resource');
  for (const [index, tile] of pattern.tiles.entries())
    if (!Object.hasOwn(pattern.tileRules, tile.type))
      fail(`${root}.tiles[${index}].type`, 'unknown tile rule');
  if (pattern.tileRules[pattern.tiles.at(-1)?.type ?? '']?.kind !== 'finish')
    fail(
      `${root}.tiles[${pattern.tiles.length - 1}].type`,
      'last tile must be finish',
    );
  for (const [key, rule] of Object.entries(pattern.tileRules))
    if (
      (rule.kind === 'skip' && rule.amount < 1) ||
      (rule.kind === 'gain' && rule.amount < 0)
    )
      fail(
        `${root}.${authoringProperty('tileRules', key)}.amount`,
        'invalid rule amount',
      );
  const seen = new Set<number>();
  for (const [index, card] of pattern.cards.entries()) {
    if (seen.has(card.id))
      fail(`${root}.cards[${index}].id`, 'duplicate value');
    seen.add(card.id);
  }
}
