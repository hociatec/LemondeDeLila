import { GameConfigurationError } from '../../core/domain/errors/game-domain.errors';
import type { TeamPawnRaceProgram } from '../effect-packs/race-team-pawn-capture/program';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
} from '../../engine/runtime/contracts/json-author-schema';
import type { GameComponentDefinition } from '../../engine/runtime/definitions/component-kit';

const label = { type: 'string', minLength: 1, maxLength: 200 } as const;
export const jsonTeamPawnRaceSchema = object({
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
  entryRolls: array(positive, 1),
  extraTurnRolls: array(positive),
  startPositions: array({ type: 'integer', minimum: 0 }, 2),
  homeRolls: array(positive),
});

export function assertTeamPawnRaceReferences(
  program: TeamPawnRaceProgram,
  components: readonly GameComponentDefinition[],
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`TeamPawn race: ${reason}`);
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
  if (
    program.startPositions.length < program.families.length ||
    program.startPositions.some(
      (position) => position >= program.trackLength,
    ) ||
    new Set(program.startPositions).size !== program.startPositions.length
  )
    fail('invalid start positions');
  if (program.homeRolls.length !== program.homeLength - 1)
    fail('one roll per home transition required');
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
