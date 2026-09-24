import {
  authoringFailure,
  authoringProperty,
  type AuthoringFailure,
} from '../../../engine/sdk/extension-api';
import type { DeliveryRaceProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';
import {
  authorArray as array,
  authorId as id,
  authorObject as object,
} from '../../../engine/sdk/extension-api';

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
  const fail = authoringFailure(
    'game.json.deliveryRace',
    program,
    'Delivery race: ',
  );
  const track = components.find(
    (c) => c.component === 'movement.track' && c.id === program.trackId,
  );
  if (track?.component !== 'movement.track') fail('trackId', 'unknown track');
  if (
    track?.component === 'movement.track' &&
    track.spaces !== program.tiles.length
  )
    fail('tiles', 'one tile per track position required');
  if (
    !components.some(
      (c) => c.component === 'dice.set' && c.id === program.diceId,
    )
  )
    fail('diceId', 'unknown dice');
  for (const [deckField, attributeField] of [
    ['clientDeckId', 'destinationAttribute'],
    ['eventDeckId', 'blockedPositionAttribute'],
  ] as const) {
    const index = components.findIndex(
      (c) => c.component === 'cards.deck' && c.id === program[deckField],
    );
    const deck = components[index];
    if (deck?.component !== 'cards.deck') fail(deckField, 'unknown deck');
    if (deck?.component === 'cards.deck')
      assertNumericAttribute(
        deck.cards,
        program[attributeField],
        index,
        components,
      );
  }
  const hand = components.find(
    (c) => c.component === 'cards.hands' && c.id === program.clientHandId,
  );
  if (
    hand?.component !== 'cards.hands' ||
    hand.deck !== program.clientDeckId ||
    hand.initial !== 0
  )
    fail(
      'clientHandId',
      'client hand must belong to the client deck and start empty',
    );
}

function assertNumericAttribute(
  cards: readonly unknown[],
  attribute: string,
  deckIndex: number,
  components: readonly GameComponentDefinition[],
): void {
  const fail: AuthoringFailure = authoringFailure('game.json', { components });
  for (const [i, card] of cards.entries()) {
    const field = `components[${deckIndex}].cards[${i}]`;
    if (card === null || typeof card !== 'object')
      fail(field, 'identified card object required');
    if (!('id' in card)) fail(`${field}.id`, 'card identifier required');
    if (
      !('attributes' in card) ||
      card.attributes === null ||
      typeof card.attributes !== 'object'
    )
      fail(`${field}.attributes`, 'numeric card attributes required');
    if (typeof Reflect.get(card.attributes, attribute) !== 'number')
      fail(
        authoringProperty(`${field}.attributes`, attribute),
        'numeric card attribute required',
      );
  }
}
