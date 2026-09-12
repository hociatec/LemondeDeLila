import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { ProtectedHauntedRaceProgram } from '../effect-packs/race-protected-haunted-track/program';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';
import type { GameComponentDefinition } from './component-kit';

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
      category: { enum: ['trap', 'prank', 'ghost', 'bonus'] },
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
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`ProtectedHaunted race: ${reason}`);
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
  if (program.tiles.some((tile, index) => tile.n !== index + 1))
    fail('invalid tile order');
  if (program.tiles.at(-1)?.type !== 'finish') fail('last tile must finish');
  if (
    new Set(program.cards.map((card) => card.id)).size !== program.cards.length
  )
    fail('duplicate card id');
}
