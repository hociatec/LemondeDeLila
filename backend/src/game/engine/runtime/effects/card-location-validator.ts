import type { CardLocation } from '../contracts/card-location';
import type { GameEffectInstruction } from '../contracts/effect-ir';
import type {
  GameEffectValidationReferences,
  ValidationFailure,
} from '../contracts/effect-validation';
import { requireReference } from './game-effect-reference-validator';

export function validateCardMove(
  instruction: GameEffectInstruction,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): boolean {
  if (instruction.kind !== 'move-card') return false;
  for (const side of ['source', 'destination'] as const)
    validateCardLocation(
      instruction[side],
      instruction.cardId,
      `${path}.${side}`,
      references,
      fail,
    );
  return true;
}

export function validateCardLocation(
  location: CardLocation,
  cardId: string | number,
  path: string,
  references: GameEffectValidationReferences,
  fail: ValidationFailure,
): void {
  let deckId: string | undefined;
  if (location.kind === 'hand') {
    requireReference(references.hands, location.handId, `${path}.handId`, fail);
    if (
      !Number.isSafeInteger(location.playerId) ||
      location.playerId === 0 ||
      (references.playerIds && !references.playerIds.has(location.playerId))
    )
      fail(`${path}.playerId`, 'invalid player');
    deckId = references.handDecks?.get(location.handId);
  } else if (location.kind === 'zone') {
    deckId = references.zoneDecks?.get(location.zoneId);
    if (!deckId) fail(`${path}.zoneId`, 'unknown zone');
  } else {
    requireReference(references.decks, location.deckId, `${path}.deckId`, fail);
    deckId = location.deckId;
  }
  // String catalogues are indexed by the shared reference validator; numeric
  // catalogue identities are validated again by the canonical card controller.
  const cards = deckId && references.cardIdsByDeck?.get(deckId);
  if (typeof cardId === 'string' && cards && !cards.has(cardId))
    fail(path, `unknown card ${cardId}`);
}
