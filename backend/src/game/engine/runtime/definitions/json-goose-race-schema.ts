import type { GooseRaceProgram } from '../extensions/goose-race/program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

const position = { type: 'integer', minimum: 0, maximum: 10000 } as const;
export const jsonGooseRaceSchema = object({
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
        type: {
          enum: [
            'start',
            'goose',
            'bridge',
            'inn',
            'magic-die',
            'labyrinth',
            'prison',
            'death',
            'well',
            'normal',
            'finish',
          ],
        },
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
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Goose race: ${reason}`);
  };
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
    fail('matching bounce track required');
  if (
    !components.some(
      (component) =>
        component.component === 'dice.set' && component.id === program.diceId,
    )
  )
    fail('unknown dice');
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
    fail('one available pawn per player required');
  if (!Object.hasOwn(phases, program.playingPhase)) fail('unknown phase');
  if (program.bridgeDestination >= program.tiles.length)
    fail('bridge destination outside track');
  for (const tile of program.tiles)
    if (tile.backTo !== undefined && tile.backTo >= program.tiles.length)
      fail('back destination outside track');
}
