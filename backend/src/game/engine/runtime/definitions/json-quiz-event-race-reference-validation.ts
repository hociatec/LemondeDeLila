import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';
type Failure = (path: string, reason: string) => never;
export function assertQuizEventRaceReferences(
  pattern: Extract<JsonGamePattern, { kind: 'quiz-event-race' }>,
  index: number,
  components: readonly GameComponentDefinition[],
  fail: Failure,
): void {
  const root = `patterns[${index}]`;
  const track = components.find(
    (item) =>
      item.component === 'movement.track' && item.id === pattern.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== pattern.tiles.length
  )
    fail(`${root}.trackId`, 'one tile per track position required');
  for (const field of [
    'questionDeckId',
    'challengeDeckId',
    'eventDeckId',
  ] as const)
    if (
      !components.some(
        (item) => item.component === 'cards.deck' && item.id === pattern[field],
      )
    )
      fail(`${root}.${field}`, `unknown deck ${pattern[field]}`);
  if (
    !components.some(
      (item) => item.component === 'dice.set' && item.id === pattern.diceId,
    )
  )
    fail(`${root}.diceId`, 'unknown dice');
  for (const [i, tile] of pattern.tiles.entries()) {
    if (tile.n !== i + 1) fail(`${root}.tiles[${i}].n`, 'invalid tile order');
    if (
      tile.type === 'goto' &&
      (tile.target == null || tile.target > pattern.tiles.length)
    )
      fail(
        `${root}.tiles[${i}].target`,
        `invalid destination on tile ${tile.n}`,
      );
  }
  if (pattern.tiles[0]?.type !== 'start')
    fail(`${root}.tiles[0].type`, 'invalid start tile');
  if (pattern.tiles.at(-1)?.type !== 'finish')
    fail(
      `${root}.tiles[${pattern.tiles.length - 1}].type`,
      'invalid finish tile',
    );
  for (const field of ['questions', 'challenges'] as const)
    for (const [cardIndex, card] of pattern[field].entries())
      if (card.correctIndex >= card.choices.length)
        fail(
          `${root}.${field}[${cardIndex}].correctIndex`,
          'answer outside choices',
        );
}
