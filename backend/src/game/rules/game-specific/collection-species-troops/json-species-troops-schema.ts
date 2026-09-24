import { assertUniqueAuthorIds } from '../../../engine/sdk/extension-api';
import { assertUniqueAuthorValues } from '../../../engine/sdk/extension-api';
import { authoringFailure } from '../../../engine/sdk/extension-api';
import type { SpeciesTroopsProgram } from './program';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../../../engine/sdk/extension-api';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';

const species = id;

export const jsonSpeciesTroopsSchema = object({
  deckId: id,
  handId: id,
  inventoryId: id,
  exchangeChoiceId: id,
  handLimit: positive,
  victoryReason: id,
  species: array(species, 1),
  cards: array(
    object(
      {
        id,
        name: { type: 'string', minLength: 1, maxLength: 1000 },
        type: { enum: ['monkey', 'action', 'trap', 'joker'] },
        species,
        action: id,
        trap: id,
        effects: array(ref('effect')),
      },
      ['id', 'name', 'type', 'effects'],
    ),
    1,
  ),
});

export function assertSpeciesTroopsReferences(
  program: SpeciesTroopsProgram,
  components: readonly GameComponentDefinition[],
) {
  const fail = authoringFailure(
    'game.json.speciesTroops',
    program,
    'Species troops: ',
  );
  if (
    !components.some(
      (item) => item.component === 'cards.deck' && item.id === program.deckId,
    )
  )
    fail('deckId', 'unknown deck');
  if (
    !components.some(
      (item) => item.component === 'cards.hands' && item.id === program.handId,
    )
  )
    fail('handId', 'unknown hand');
  if (
    !components.some(
      (item) =>
        item.component === 'inventory.set' && item.id === program.inventoryId,
    )
  )
    fail('inventoryId', 'unknown inventory');
  assertUniqueAuthorIds(program.cards, 'cards', fail);
  assertUniqueAuthorValues(program.species, (i) => `species[${i}]`, fail);
  program.species.forEach((value, i) => {
    if (value.includes(':'))
      fail(
        `species[${i}]`,
        'collection kind cannot contain the inventory separator',
      );
  });
  for (const [i, card] of program.cards.entries()) {
    if (card.species != null && !program.species.includes(card.species))
      fail(`cards[${i}].species`, 'unknown collection kind on ' + card.id);
    if (card.type === 'monkey' && !card.species)
      fail(`cards[${i}].species`, `missing species on ${card.id}`);
    if (card.type === 'action' && !card.action)
      fail(`cards[${i}].action`, `missing action on ${card.id}`);
    if (card.type === 'trap' && !card.trap)
      fail(`cards[${i}].trap`, `missing trap on ${card.id}`);
  }
}
