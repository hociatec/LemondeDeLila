import type { DeliveryRaceProgram } from '../contracts/delivery-race-program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

export const jsonDeliveryRaceSchema = object({
  trackId: id,
  diceId: id,
  clientDeckId: id,
  clientHandId: id,
  eventDeckId: id,
  destinationAttribute: id,
  blockedPositionAttribute: id,
  positionOffset: { type: 'integer', minimum: -10000, maximum: 10000 },
  targetScore: { type: 'integer', minimum: 1, maximum: 1000000 },
  finishReason: id,
  eventNamespace: id,
  tiles: array(
    object(
      {
        id: { oneOf: [id, { type: 'integer' }] },
        title: { type: 'string', minLength: 1, maxLength: 10000 },
      },
      ['id', 'title'],
    ),
    2,
  ),
});

export function assertDeliveryRaceReferences(
  program: DeliveryRaceProgram,
  components: readonly GameComponentDefinition[],
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Delivery race: ${reason}`);
  };
  const track = components.find(
    (component) =>
      component.component === 'movement.track' &&
      component.id === program.trackId,
  );
  if (track?.component !== 'movement.track') fail('unknown track');
  if (
    track?.component === 'movement.track' &&
    track.spaces !== program.tiles.length
  )
    fail('one tile per track position required');
  if (
    !components.some(
      (component) =>
        component.component === 'dice.set' && component.id === program.diceId,
    )
  )
    fail('unknown dice');
  const clients = findDeck(components, program.clientDeckId, fail);
  const events = findDeck(components, program.eventDeckId, fail);
  const hand = components.find(
    (component) =>
      component.component === 'cards.hands' &&
      component.id === program.clientHandId,
  );
  if (
    hand?.component !== 'cards.hands' ||
    hand.deck !== program.clientDeckId ||
    hand.initial !== 0
  )
    fail('client hand must belong to the client deck and start empty');
  assertNumericAttribute(
    clients,
    program.destinationAttribute,
    'client destination',
    fail,
  );
  assertNumericAttribute(
    events,
    program.blockedPositionAttribute,
    'blocked position',
    fail,
  );
}

function findDeck(
  components: readonly GameComponentDefinition[],
  id: string,
  fail: (reason: string) => never,
) {
  const deck = components.find(
    (component) => component.component === 'cards.deck' && component.id === id,
  );
  if (deck?.component !== 'cards.deck') fail(`unknown deck ${id}`);
  return deck.cards;
}

function assertNumericAttribute(
  cards: readonly unknown[],
  attribute: string,
  label: string,
  fail: (reason: string) => never,
): void {
  if (
    cards.some(
      (card) =>
        card === null ||
        typeof card !== 'object' ||
        !('id' in card) ||
        !('attributes' in card) ||
        card.attributes === null ||
        typeof card.attributes !== 'object' ||
        typeof Reflect.get(card.attributes, attribute) !== 'number',
    )
  )
    fail(`${label} requires numeric card attributes`);
}
