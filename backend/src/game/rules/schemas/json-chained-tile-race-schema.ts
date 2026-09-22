import type { ChainedTileRaceProgram } from '../effect-packs/race-chained-tile-cards/program';
import { GameConfigurationError } from '../../core/domain/errors/game-domain.errors';
import type { GameComponentDefinition } from '../../engine/runtime/definitions/component-kit';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorRecord as record,
  authorObject as object,
  authorPositive as positive,
} from '../../engine/runtime/contracts/json-author-schema';
import { effectJsonSchema } from '../../engine/runtime/contracts/effect-json-schema';

export const jsonChainedTileRaceSchema: AuthorSchema = object({
  finishReason: id,
  selectionDrawCount: { type: 'integer', minimum: 1, maximum: 100 },
  tileRules: record({
    oneOf: [
      object({
        kind: { enum: ['none', 'finish', 'choose-swap', 'await-draw'] },
        description: { type: 'string' },
      }),
      object({
        kind: { enum: ['move', 'protected-move'] },
        delta: { type: 'integer' },
        description: { type: 'string' },
      }),
      object({
        kind: { const: 'random-move' },
        maximum: { type: 'integer', minimum: 1, maximum: 1000000 },
        description: { type: 'string' },
      }),
      object({
        kind: { const: 'move-to' },
        position: { type: 'integer', minimum: 0 },
        description: { type: 'string' },
      }),
    ],
  }),
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
      type: id,
      label: { type: 'string', minLength: 1, maxLength: 4000 },
    }),
    2,
  ),
});

export function assertChainedTileRaceReferences(
  program: ChainedTileRaceProgram,
  components: readonly GameComponentDefinition[],
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Chained tile race: ${reason}`);
  };
  if (
    program.tileRules[program.tiles[0]?.type]?.kind !== 'none' ||
    program.tileRules[program.tiles.at(-1)?.type ?? '']?.kind !== 'finish'
  )
    fail('track requires start and finish boundaries');
  if (
    program.tiles.some((tile) => !Object.hasOwn(program.tileRules, tile.type))
  )
    fail('unknown tile rule');
  for (const rule of Object.values(program.tileRules))
    if (rule.kind === 'move-to' && rule.position >= program.tiles.length)
      fail('unknown target position');
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
