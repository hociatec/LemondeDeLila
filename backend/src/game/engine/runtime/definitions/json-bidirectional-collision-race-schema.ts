import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { BidirectionalCollisionRaceProgram } from '../effect-packs/race-bidirectional-collision/program';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';
import type { GameComponentDefinition } from './component-kit';

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
        region: { enum: ['prairie', 'riviere', 'foret', 'montagne'] },
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
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`BidirectionalCollision race: ${reason}`);
  };
  const track = components.find(
    (item) =>
      item.component === 'movement.track' && item.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('one tile per track position required');
  if (
    !components.some(
      (item) => item.component === 'dice.set' && item.id === program.diceId,
    )
  )
    fail('unknown dice');
  if (
    !components.some(
      (item) => item.component === 'cards.deck' && item.id === program.deckId,
    )
  )
    fail('unknown deck');
  if (
    !components.some(
      (item) => item.component === 'pawn.set' && item.id === program.pawnSetId,
    )
  )
    fail('unknown pawn set');
  if (!resources.has(program.appleResource)) fail('unknown apple resource');
  if (program.tiles.some((tile, index) => tile.n !== index + 1))
    fail('invalid tile order');
  if (
    program.tiles[0]?.type !== 'start' ||
    program.tiles.at(-1)?.type !== 'finish'
  )
    fail('invalid start or finish tile');
}
