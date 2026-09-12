import type { PawnRaceProgram } from '../extensions/pawn-race/program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorId as id,
  authorArray as array,
  authorObject as object,
} from '../contracts/json-author-schema';

export const jsonPawnRaceSchema = object(
  {
    setId: id,
    diceId: id,
    choiceId: id,
    finishAt: { type: 'integer', minimum: 0, maximum: 10000 },
    finishReason: { type: 'string', minLength: 1, maxLength: 128 },
    extraTurnRolls: array({ type: 'integer', minimum: 1, maximum: 100000000 }),
  },
  ['setId', 'diceId', 'choiceId', 'finishAt', 'finishReason'],
);

export function assertPawnRaceReferences(
  program: PawnRaceProgram,
  components: readonly GameComponentDefinition[],
  maxPlayers: number,
  fail: (path: string, reason: string) => never,
): void {
  const set = components.find(
    (item) => item.component === 'pawn.set' && item.id === program.setId,
  );
  if (
    set?.component !== 'pawn.set' ||
    set.spaces === undefined ||
    program.finishAt >= set.spaces ||
    set.pawns.length < maxPlayers * set.perPlayer
  )
    fail('pawnRace.setId', 'bounded race set with enough pawns required');
  const dice = components.find(
    (item) => item.component === 'dice.set' && item.id === program.diceId,
  );
  if (dice?.component !== 'dice.set')
    return fail('pawnRace.diceId', 'unknown dice');
  if (
    program.extraTurnRolls?.some(
      (total) => total < dice.count || total > dice.count * dice.sides,
    )
  )
    fail('pawnRace.extraTurnRolls', 'unreachable roll');
  if (program.choiceId.startsWith('engine.'))
    fail('pawnRace.choiceId', 'reserved choice');
}
