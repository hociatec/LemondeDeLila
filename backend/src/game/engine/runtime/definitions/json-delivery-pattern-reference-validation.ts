import { authoringProperty } from '../contracts/authoring-diagnostics';
import type { GameComponentDefinition } from './component-kit';
import type { JsonGamePattern } from './json-game-patterns';

type Failure = (path: string, reason: string) => never;

export function assertDeliveryReferences(
  delivery: NonNullable<Extract<JsonGamePattern, { kind: 'race' }>['delivery']>,
  patternIndex: number,
  components: readonly GameComponentDefinition[],
  fail: Failure,
): void {
  const root = `patterns[${patternIndex}].delivery`;
  const clientDeck = requireDeck(
    delivery.clientDeckId,
    `${root}.clientDeckId`,
    components,
    fail,
  );
  const eventDeck = requireDeck(
    delivery.eventDeckId,
    `${root}.eventDeckId`,
    components,
    fail,
  );
  assertNumericCardAttribute(
    clientDeck.cards,
    delivery.destinationAttribute,
    `${root}.destinationAttribute`,
    fail,
  );
  assertNumericCardAttribute(
    eventDeck.cards,
    delivery.blockedPositionAttribute,
    `${root}.blockedPositionAttribute`,
    fail,
  );
  const hand = components.find(
    (component) =>
      component.component === 'cards.hands' &&
      component.id === delivery.clientHandId,
  );
  if (
    hand?.component !== 'cards.hands' ||
    hand.deck !== delivery.clientDeckId ||
    hand.initial !== 0
  )
    fail(
      `${root}.clientHandId`,
      'client hand must use the client deck and start empty',
    );
}

function requireDeck(
  id: string,
  path: string,
  components: readonly GameComponentDefinition[],
  fail: Failure,
) {
  const deck = components.find(
    (component) => component.component === 'cards.deck' && component.id === id,
  );
  if (deck?.component !== 'cards.deck') fail(path, 'unknown card deck');
  return deck;
}

function assertNumericCardAttribute(
  cards: readonly unknown[],
  attribute: string,
  path: string,
  fail: Failure,
): void {
  for (const [index, card] of cards.entries()) {
    if (card == null || typeof card !== 'object')
      fail(path, `card ${index} must be an object`);
    const attributes = Reflect.get(card, 'attributes');
    if (
      attributes == null ||
      typeof attributes !== 'object' ||
      typeof Reflect.get(attributes, attribute) !== 'number'
    )
      fail(
        authoringProperty(path, attribute),
        `numeric card attribute required on card ${index}`,
      );
  }
}
