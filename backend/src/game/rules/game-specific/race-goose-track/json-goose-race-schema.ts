import { authoringFailure } from '../../../engine/sdk/extension-api';
import type { GooseRaceProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';
import {
  authorArray as array,
  authorId as id,
  authorRecord as record,
  authorObject as object,
} from '../../../engine/sdk/extension-api';

const position = { type: 'integer', minimum: 0, maximum: 10000 } as const;
export const jsonGooseRaceSchema = object({
  tileRules: record({
    enum: [
      'none',
      'finish',
      'move-to',
      'return',
      'skip',
      'roll-directed',
      'block',
      'repeat-roll',
    ],
  }),
  escapeRolls: array({ type: 'integer', minimum: 1 }, 1),
  forwardRollMaximum: { type: 'integer', minimum: 0 },
  defaultReturn: position,
  defaultSkip: { type: 'integer', minimum: 1 },
  trackId: id,
  diceId: id,
  playingPhase: id,
  wellStatus: id,
  finishReason: id,
  maxDepth: { type: 'integer', minimum: 1, maximum: 64 },
  bridgeDestination: position,
  tiles: array(
    object(
      {
        id,
        label: { type: 'string', minLength: 1, maxLength: 2000 },
        description: { type: 'string', maxLength: 10000 },
        type: id,
        turnsToSkip: { type: 'integer', minimum: 1, maximum: 1000 },
        backTo: position,
      },
      ['id', 'label', 'type'],
    ),
    2,
  ),
  pawnSelection: object({ setId: id, choiceId: id }),
});

export function assertGooseRaceReferences(
  program: GooseRaceProgram,
  components: readonly GameComponentDefinition[],
  phases: Readonly<Record<string, unknown>>,
  maxPlayers: number,
): void {
  const fail = authoringFailure('game.json.gooseRace', program, 'Goose race: ');
  for (const [i, tile] of program.tiles.entries())
    if (!Object.hasOwn(program.tileRules, tile.type))
      fail(`tiles[${i}].type`, 'unknown tile rule');
  if (program.defaultReturn >= program.tiles.length)
    fail('defaultReturn', 'invalid default return');
  const track = components.find(
    (component) =>
      component.component === 'movement.track' &&
      component.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length ||
    track.overshoot !== 'bounce'
  )
    fail('trackId', 'matching bounce track required');
  if (
    !components.some(
      (component) =>
        component.component === 'dice.set' && component.id === program.diceId,
    )
  )
    fail('diceId', 'unknown dice');
  const pawns = components.find(
    (component) =>
      component.component === 'pawn.set' &&
      component.id === program.pawnSelection.setId,
  );
  if (
    pawns?.component !== 'pawn.set' ||
    pawns.perPlayer !== 1 ||
    pawns.pawns.length < maxPlayers
  )
    fail('pawnSelection.setId', 'one available pawn per player required');
  if (!Object.hasOwn(phases, program.playingPhase))
    fail('playingPhase', 'unknown phase');
  if (program.bridgeDestination >= program.tiles.length)
    fail('bridgeDestination', 'bridge destination outside track');
  for (const [i, tile] of program.tiles.entries())
    if (tile.backTo !== undefined && tile.backTo >= program.tiles.length)
      fail(`tiles[${i}].backTo`, 'back destination outside track');
}
