import type { BalloonRaceProgram } from '../contracts/balloon-race-program';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { GameComponentDefinition } from './component-kit';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
} from '../contracts/json-author-schema';
import { effectJsonSchema } from '../contracts/effect-json-schema';

export const jsonBalloonRaceSchema: AuthorSchema = object({
  trackId: id,
  pawnSetId: id,
  pawnChoiceId: id,
  deckId: id,
  diceId: id,
  trapImmunityStatusId: id,
  awaitingCardStatusId: id,
  maxResolutionDepth: { type: 'integer', minimum: 1, maximum: 100 },
  cards: array(
    object({
      id: positive,
      text: { type: 'string', minLength: 1, maxLength: 4000 },
      retreatScore: { type: 'integer', minimum: -1000000, maximum: 1000000 },
      effects: effectJsonSchema,
    }),
    1,
  ),
  pawns: array(
    object({
      id,
      label: { type: 'string', minLength: 1, maxLength: 4000 },
      description: { type: 'string', minLength: 1, maxLength: 4000 },
    }),
    2,
  ),
  tiles: array(
    object({
      type: {
        enum: [
          'start',
          'neutral',
          'bonus',
          'folie',
          'piege',
          'glissade',
          'tornade',
          'chaton',
          'finish',
        ],
      },
      label: { type: 'string', minLength: 1, maxLength: 4000 },
    }),
    2,
  ),
});

export function assertBalloonRaceReferences(
  program: BalloonRaceProgram,
  components: readonly GameComponentDefinition[],
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Balloon race: ${reason}`);
  };
  if (
    program.tiles[0]?.type !== 'start' ||
    program.tiles.at(-1)?.type !== 'finish'
  )
    fail('track requires start and finish boundaries');
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
  if (
    new Set(program.cards.map((card) => card.id)).size !== program.cards.length
  )
    fail('card identifiers must be unique');
  if (
    new Set(program.pawns.map((pawn) => pawn.id)).size !== program.pawns.length
  )
    fail('pawn identifiers must be unique');
}
