import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { FamilyEffectsProgram } from '../effect-packs/collection-family-effects/program';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorRef as ref,
} from '../contracts/json-author-schema';
import type { GameComponentDefinition } from './component-kit';

const text = { type: 'string', minLength: 1, maxLength: 10000 } as const;

export const jsonFamilyEffectsSchema = object({
  deckId: id,
  handId: id,
  setsId: id,
  cards: array(
    object(
      {
        id,
        name: text,
        type: { enum: ['metier', 'special'] },
        family: id,
        effects: array(ref('effect')),
      },
      ['id', 'name', 'type', 'effects'],
    ),
    1,
  ),
  familyIds: array(id, 1),
  extraDrawResource: id,
  freeRequestStatus: id,
  vanishedStatus: id,
  finishReason: id,
  eventNamespace: id,
});

export function assertFamilyEffectsReferences(
  program: FamilyEffectsProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Family effects: ${reason}`);
  };
  const deck = components.find(
    (item) => item.component === 'cards.deck' && item.id === program.deckId,
  );
  const hand = components.find(
    (item) => item.component === 'cards.hands' && item.id === program.handId,
  );
  const sets = components.find(
    (item) => item.component === 'cards.sets' && item.id === program.setsId,
  );
  if (deck?.component !== 'cards.deck') fail('unknown deck');
  if (hand?.component !== 'cards.hands' || hand.deck !== program.deckId)
    fail('unknown hand or mismatched deck');
  if (
    sets?.component !== 'cards.sets' ||
    sets.deck !== program.deckId ||
    sets.hand !== program.handId
  )
    fail('unknown card sets or mismatched source');
  if (!resources.has(program.extraDrawResource))
    fail('unknown extra draw resource');
  const ids = new Set(program.cards.map((card) => card.id));
  if (ids.size !== program.cards.length) fail('duplicate card id');
  if (new Set(program.familyIds).size !== program.familyIds.length)
    fail('duplicate family id');
  for (const card of program.cards) {
    if (card.type === 'metier' && !card.family)
      fail('profession without family');
    if (card.type === 'special' && card.family)
      fail('special card with family');
    if (card.family && !program.familyIds.includes(card.family))
      fail('unknown card family');
  }
  if (
    sets?.component === 'cards.sets' &&
    (Object.keys(sets.sets).some(
      (family) => !program.familyIds.includes(family),
    ) ||
      Object.values(sets.sets)
        .flat()
        .some((cardId) => !ids.has(cardId)))
  )
    fail('invalid family set');
}
