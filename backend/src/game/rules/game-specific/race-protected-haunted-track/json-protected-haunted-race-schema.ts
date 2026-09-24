import { assertUniqueAuthorIds } from '../../../engine/sdk/extension-api';
import { assertUniqueAuthorValues } from '../../../engine/sdk/extension-api';
import { authoringFailure } from '../../../engine/sdk/extension-api';
import type { ProtectedHauntedRaceProgram } from './program';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../../../engine/sdk/extension-api';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';

const text = { type: 'string', minLength: 1, maxLength: 10000 } as const;
const statuses = object({
  ignoreNextTrap: id,
  ignoreTrapUntilNextDraw: id,
  ignoreNextPrank: id,
  ignoreNextGhost: id,
  nextMoveCap: id,
  nextRollMalus: id,
  nextRollKeepLowest: id,
  nextRollDouble: id,
  nextRollIfThreeBackTwo: id,
  blocked: id,
});

export const jsonProtectedHauntedRaceSchema = object({
  conditionalMove: object({
    equals: { type: 'integer' },
    delta: { type: 'integer' },
  }),
  protections: array(
    object({
      category: id,
      status: id,
      consume: { enum: ['draw', 'matching-card'] },
    }),
  ),
  trackId: id,
  diceId: id,
  deckId: id,
  pawnSetId: id,
  pawnChoiceId: id,
  swapChoiceId: id,
  maxChainDepth: positive,
  finishReason: id,
  eventNamespace: id,
  statuses,
  tiles: array(
    object({
      n: positive,
      title: text,
      label: text,
      description: text,
      type: { enum: ['neutral', 'card', 'finish'] },
    }),
    2,
  ),
  cards: array(
    object({
      id: positive,
      localNumber: positive,
      category: id,
      text,
      effects: array(ref('effect')),
    }),
    1,
  ),
});

export function assertProtectedHauntedRaceReferences(
  program: ProtectedHauntedRaceProgram,
  components: readonly GameComponentDefinition[],
): void {
  const fail = authoringFailure(
    'game.json.protectedHauntedRace',
    program,
    'ProtectedHaunted race: ',
  );
  for (const [i, rule] of program.protections.entries())
    if (!program.cards.some((card) => card.category === rule.category))
      fail(`protections[${i}].category`, 'unknown protected category');
  assertUniqueAuthorValues(
    program.protections.map((rule) => rule.status),
    (i) => `protections[${i}].status`,
    fail,
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
  for (const [i, tile] of program.tiles.entries())
    if (tile.n !== i + 1) fail(`tiles[${i}].n`, 'invalid tile order');
  if (program.tiles.at(-1)?.type !== 'finish')
    fail(`tiles[${program.tiles.length - 1}].type`, 'last tile must finish');
  assertUniqueAuthorIds(program.cards, 'cards', fail);
}
