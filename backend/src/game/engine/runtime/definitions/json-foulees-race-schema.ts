import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { FouleesRaceProgram } from '../contracts/foulees-race-program';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
} from '../contracts/json-author-schema';
import type { GameComponentDefinition } from './component-kit';

const label = { type: 'string', minLength: 1, maxLength: 200 } as const;
export const jsonFouleesRaceSchema = object({
  setId: id,
  diceId: id,
  familyChoiceId: id,
  moveChoiceId: id,
  families: array(
    object({ id, family: label, habitat: label, pawns: array(label, 1) }),
    2,
  ),
  trackLength: positive,
  homeLength: positive,
  safeTiles: array({ type: 'integer', minimum: 0, maximum: 10000 }),
  finishReason: id,
});

export function assertFouleesRaceReferences(
  program: FouleesRaceProgram,
  components: readonly GameComponentDefinition[],
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Foulees race: ${reason}`);
  };
  const set = components.find(
    (item) => item.component === 'pawn.set' && item.id === program.setId,
  );
  const dice = components.find(
    (item) => item.component === 'dice.set' && item.id === program.diceId,
  );
  if (
    set?.component !== 'pawn.set' ||
    set.spaces !== program.trackLength + program.homeLength
  )
    fail('invalid pawn set');
  if (dice?.component !== 'dice.set') fail('unknown dice');
  if (program.safeTiles.some((tile) => tile >= program.trackLength))
    fail('safe tile outside track');
  if (
    new Set(program.families.map((family) => family.id)).size !==
    program.families.length
  )
    fail('duplicate family');
  if (
    set?.component === 'pawn.set' &&
    program.families.some((family) => family.pawns.length !== set.perPlayer)
  )
    fail('family pawn count mismatch');
}
