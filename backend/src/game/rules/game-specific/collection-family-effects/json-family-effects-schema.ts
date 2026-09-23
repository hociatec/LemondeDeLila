import { assertUniqueAuthorIds } from '../../../engine/runtime/contracts/authoring-diagnostics';
import {
  authoringFailure,
  assertUniqueAuthorValues,
} from '../../../engine/runtime/contracts/authoring-diagnostics';
import type { FamilyEffectsProgram } from './program';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorRef as ref,
} from '../../../engine/runtime/contracts/json-author-schema';
import type { GameComponentDefinition } from '../../../engine/runtime/definitions/component-kit';

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
  const fail = authoringFailure(
    'game.json.familyEffects',
    program,
    'Family effects: ',
  );
  const deck = components.find(
    (item) => item.component === 'cards.deck' && item.id === program.deckId,
  );
  const hand = components.find(
    (item) => item.component === 'cards.hands' && item.id === program.handId,
  );
  const sets = components.find(
    (item) => item.component === 'cards.sets' && item.id === program.setsId,
  );
  if (deck?.component !== 'cards.deck') fail('deckId', 'unknown deck');
  if (hand?.component !== 'cards.hands' || hand.deck !== program.deckId)
    fail('handId', 'unknown hand or mismatched deck');
  if (
    sets?.component !== 'cards.sets' ||
    sets.deck !== program.deckId ||
    sets.hand !== program.handId
  )
    fail('setsId', 'unknown card sets or mismatched source');
  if (!resources.has(program.extraDrawResource))
    fail('extraDrawResource', 'unknown extra draw resource');
  const ids = new Set(program.cards.map((card) => card.id));
  assertUniqueAuthorIds(program.cards, 'cards', fail);
  assertUniqueAuthorValues(program.familyIds, (i) => `familyIds[${i}]`, fail);
  for (const [i, card] of program.cards.entries()) {
    if (card.type === 'metier' && !card.family)
      fail(`cards[${i}].family`, 'profession without family');
    if (card.type === 'special' && card.family)
      fail(`cards[${i}].family`, 'special card with family');
    if (card.family && !program.familyIds.includes(card.family))
      fail(`cards[${i}].family`, 'unknown card family');
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
    fail('setsId', 'invalid family set');
}
