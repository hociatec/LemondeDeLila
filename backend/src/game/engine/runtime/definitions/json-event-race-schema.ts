import type { EventRaceProgram } from '../extensions/event-race/program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorArray as array,
  authorObject as object,
  authorId as id,
} from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

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
  const fail = (message: string): never => {
    throw new GameConfigurationError(`Event race: ${message}`);
  };
  const track = components.find(
    (c) => c.component === 'movement.track' && c.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('one tile per track position required');
  if (
    !components.some(
      (c) => c.component === 'dice.set' && c.id === program.diceId,
    )
  )
    fail('unknown dice');
  for (const tile of program.tiles) {
    if (!tile.deckId) continue;
    const deck = components.find(
      (c) => c.component === 'cards.deck' && c.id === tile.deckId,
    );
    if (deck?.component !== 'cards.deck') fail('unknown event deck');
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
      fail('event cards require identifiers, effects and a matching deck');
  }
  const pawns = components.find(
    (c) => c.component === 'pawn.set' && c.id === program.pawnSelection.setId,
  );
  if (
    pawns?.component !== 'pawn.set' ||
    pawns.perPlayer !== 1 ||
    pawns.pawns.length < maxPlayers
  )
    fail('one available pawn per player required');
  if (
    initialPhase === program.playingPhase ||
    !phases[initialPhase]?.transitions?.includes(program.playingPhase)
  )
    fail('setup must transition to the playing phase');
}
