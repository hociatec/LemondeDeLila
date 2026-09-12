import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { SpeciesTroopsProgram } from '../effect-packs/collection-species-troops/program';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';
import type { GameComponentDefinition } from './component-kit';

const species = {
  enum: ['capucin', 'mandrill', 'gibbon', 'babouin', 'macaque'],
} as const;

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
        action: {
          enum: ['vol-de-banane', 'cris-de-la-jungle', 'grimpeur-fou'],
        },
        trap: { enum: ['piege-a-noix-de-coco', 'tigre-rodeur'] },
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
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Species troops: ${reason}`);
  };
  if (
    !components.some(
      (item) => item.component === 'cards.deck' && item.id === program.deckId,
    )
  )
    fail('unknown deck');
  if (
    !components.some(
      (item) => item.component === 'cards.hands' && item.id === program.handId,
    )
  )
    fail('unknown hand');
  if (
    !components.some(
      (item) =>
        item.component === 'inventory.set' && item.id === program.inventoryId,
    )
  )
    fail('unknown inventory');
  if (
    new Set(program.cards.map((card) => card.id)).size !== program.cards.length
  )
    fail('duplicate card id');
  for (const card of program.cards) {
    if (card.type === 'monkey' && !card.species)
      fail(`missing species on ${card.id}`);
    if (card.type === 'action' && !card.action)
      fail(`missing action on ${card.id}`);
    if (card.type === 'trap' && !card.trap) fail(`missing trap on ${card.id}`);
  }
}
