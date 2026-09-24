import {
  authoringFailure,
  authoringProperty,
  assertUniqueAuthorValues,
} from '../../../engine/sdk/extension-api';
import type { ChainedTileRaceProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';
import {
  type AuthorSchema,
  authorArray as array,
  authorId as id,
  authorRecord as record,
  authorObject as object,
  authorPositive as positive,
} from '../../../engine/sdk/extension-api';
import { effectJsonSchema } from '../../../engine/sdk/extension-api';

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
  components?: readonly GameComponentDefinition[],
): void {
  const fail = authoringFailure(
    'game.json.chainedTileRace',
    program,
    'Chained tile race: ',
  );
  if (program.tileRules[program.tiles[0]?.type]?.kind !== 'none')
    fail('tiles[0].type', 'track requires a start boundary');
  if (program.tileRules[program.tiles.at(-1)?.type ?? '']?.kind !== 'finish')
    fail(
      `tiles[${program.tiles.length - 1}].type`,
      'track requires a finish boundary',
    );
  for (const [i, tile] of program.tiles.entries())
    if (!Object.hasOwn(program.tileRules, tile.type))
      fail(`tiles[${i}].type`, 'unknown tile rule');
  for (const [key, rule] of Object.entries(program.tileRules))
    if (rule.kind === 'move-to' && rule.position >= program.tiles.length)
      fail(
        `${authoringProperty('tileRules', key)}.position`,
        'unknown target position',
      );
  if (!components) return;
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
  for (const field of ['cards', 'pawns'] as const)
    assertUniqueAuthorValues(
      program[field].map((item) => item.id),
      (i) => `${field}[${i}].id`,
      fail,
    );
}
