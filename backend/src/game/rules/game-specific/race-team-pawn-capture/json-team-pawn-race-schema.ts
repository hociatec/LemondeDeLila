import { assertUniqueAuthorIds } from '../../../engine/sdk/extension-api';
import {
  authoringFailure,
  assertUniqueAuthorValues,
} from '../../../engine/sdk/extension-api';
import type { TeamPawnRaceProgram } from './program';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
} from '../../../engine/sdk/extension-api';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';

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
  components?: readonly GameComponentDefinition[],
): void {
  const fail = authoringFailure(
    'game.json.teamPawnRace',
    program,
    'TeamPawn race: ',
  );
  assertUniqueAuthorIds(program.families, 'families', fail);
  if (!components) return;
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
    fail('setId', 'invalid pawn set');
  if (dice?.component !== 'dice.set') fail('diceId', 'unknown dice');
  if (program.startPositions.length < program.families.length)
    fail('startPositions', 'invalid start positions');
  if (program.homeRolls.length !== program.homeLength - 1)
    fail('homeRolls', 'one roll per home transition required');
  for (const field of ['startPositions', 'safeTiles'] as const)
    program[field].forEach((position, i) => {
      if (position >= program.trackLength)
        fail(`${field}[${i}]`, 'position outside track');
    });
  assertUniqueAuthorValues(
    program.startPositions,
    (i) => `startPositions[${i}]`,
    fail,
  );
  program.families.forEach((family, i) => {
    if (set?.component === 'pawn.set' && family.pawns.length !== set.perPlayer)
      fail(`families[${i}].pawns`, 'family pawn count mismatch');
  });
}
