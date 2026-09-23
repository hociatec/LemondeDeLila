import { authoringFailure } from '../../../engine/runtime/contracts/authoring-diagnostics';
import type { EventRaceProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/runtime/definitions/component-kit';
import {
  authorArray as array,
  authorObject as object,
  authorId as id,
} from '../../../engine/runtime/contracts/json-author-schema';

export const jsonEventRaceSchema = object({
  trackId: id,
  diceId: id,
  playingPhase: id,
  landingEffectId: id,
  tiles: array(object({ label: { type: 'string' }, deckId: id }, ['label']), 2),
  pawnSelection: object({ setId: id, choiceId: id }),
});

export function assertEventRaceReferences(
  program: EventRaceProgram,
  components: readonly GameComponentDefinition[],
  phases: Readonly<Record<string, { transitions?: readonly string[] }>>,
  initialPhase: string,
  maxPlayers: number,
): void {
  const fail = authoringFailure('game.json.eventRace', program, 'Event race: ');
  const track = components.find(
    (c) => c.component === 'movement.track' && c.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('trackId', 'one tile per track position required');
  if (
    !components.some(
      (c) => c.component === 'dice.set' && c.id === program.diceId,
    )
  )
    fail('diceId', 'unknown dice');
  for (const [i, tile] of program.tiles.entries()) {
    if (!tile.deckId) continue;
    const deck = components.find(
      (c) => c.component === 'cards.deck' && c.id === tile.deckId,
    );
    if (deck?.component !== 'cards.deck')
      fail(`tiles[${i}].deckId`, 'unknown event deck');
    else if (
      deck.cards.some(
        (card) =>
          card == null ||
          typeof card !== 'object' ||
          !('id' in card) ||
          !('effects' in card) ||
          ('deck' in card && card.deck !== tile.deckId),
      )
    )
      fail(
        `tiles[${i}].deckId`,
        'event cards require identifiers, effects and a matching deck',
      );
  }
  const pawns = components.find(
    (c) => c.component === 'pawn.set' && c.id === program.pawnSelection.setId,
  );
  if (
    pawns?.component !== 'pawn.set' ||
    pawns.perPlayer !== 1 ||
    pawns.pawns.length < maxPlayers
  )
    fail('pawnSelection.setId', 'one available pawn per player required');
  if (
    initialPhase === program.playingPhase ||
    !phases[initialPhase]?.transitions?.includes(program.playingPhase)
  )
    fail('playingPhase', 'setup must transition to the playing phase');
}
