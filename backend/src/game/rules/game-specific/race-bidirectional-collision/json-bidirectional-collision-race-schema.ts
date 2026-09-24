import { authoringFailure } from '../../../engine/sdk/extension-api';
import type { BidirectionalCollisionRaceProgram } from './program';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../../../engine/sdk/extension-api';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';

export const jsonBidirectionalCollisionRaceSchema = object({
  trackId: id,
  diceId: id,
  deckId: id,
  pawnSetId: id,
  pawnChoiceId: id,
  appleResource: id,
  iouPrefix: id,
  returningStatus: id,
  applesToWin: positive,
  maxDepth: positive,
  finishReason: id,
  tiles: array(
    object(
      {
        n: positive,
        type: { enum: ['start', 'neutral', 'card', 'bonus', 'skip', 'finish'] },
        region: id,
        title: { type: 'string', maxLength: 10000 },
        label: { type: 'string', maxLength: 10000 },
        description: { type: 'string', maxLength: 10000 },
        apples: { type: 'integer', minimum: 0, maximum: 1000000 },
        skipTurns: { type: 'integer', minimum: 0, maximum: 1000000 },
      },
      ['n', 'type', 'region'],
    ),
    2,
  ),
  cards: array(
    object({
      id: positive,
      text: { type: 'string', minLength: 1, maxLength: 10000 },
      effects: array(ref('effect')),
    }),
    1,
  ),
});

export function assertBidirectionalCollisionRaceReferences(
  program: BidirectionalCollisionRaceProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
): void {
  const fail = authoringFailure(
    'game.json.bidirectionalCollisionRace',
    program,
    'BidirectionalCollision race: ',
  );
  const track = components.find(
    (item) =>
      item.component === 'movement.track' && item.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('trackId', 'one tile per track position required');
  if (
    !components.some(
      (item) => item.component === 'dice.set' && item.id === program.diceId,
    )
  )
    fail('diceId', 'unknown dice');
  if (
    !components.some(
      (item) => item.component === 'cards.deck' && item.id === program.deckId,
    )
  )
    fail('deckId', 'unknown deck');
  if (
    !components.some(
      (item) => item.component === 'pawn.set' && item.id === program.pawnSetId,
    )
  )
    fail('pawnSetId', 'unknown pawn set');
  if (!resources.has(program.appleResource))
    fail('appleResource', 'unknown apple resource');
  for (const [i, tile] of program.tiles.entries())
    if (tile.n !== i + 1) fail(`tiles[${i}].n`, 'invalid tile order');
  if (program.tiles[0]?.type !== 'start')
    fail('tiles[0].type', 'invalid start tile');
  if (program.tiles.at(-1)?.type !== 'finish')
    fail(`tiles[${program.tiles.length - 1}].type`, 'invalid finish tile');
}
