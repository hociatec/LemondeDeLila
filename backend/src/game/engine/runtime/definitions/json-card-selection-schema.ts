import type { CardSelectionProgram } from '../contracts/card-selection-contract';
import type { GameComponentDefinition } from './component-kit';
import {
  authorObject as object,
  authorId as id,
  authorArray as array,
  authorRef as ref,
  authorBoolean as boolean,
  authorRecord as record,
  type AuthorSchema,
} from '../contracts/json-author-schema';
import { AuthoringError, authoringValueAt } from '../contracts/authoring-error';

const owner: AuthorSchema = { enum: ['actor', 'next', 'previous'] };
const count: AuthorSchema = { type: 'integer', minimum: 0, maximum: 1000 };
const cardId: AuthorSchema = { oneOf: [id, { type: 'integer' }] };
export const cardAttributesSchema = record({
  oneOf: [
    { type: 'string', maxLength: 256 },
    { type: 'number' },
    boolean,
    { type: 'null' },
  ],
});
export const jsonCardSelectionSchema = object(
  {
    choiceId: id,
    chooser: owner,
    source: {
      oneOf: [
        object({ kind: { const: 'deck' }, deckId: id }),
        object({ kind: { const: 'discard' }, deckId: id }),
        object({ kind: { const: 'hand' }, deckId: id, handId: id, owner }, [
          'kind',
          'deckId',
          'handId',
        ]),
      ],
    },
    destination: {
      oneOf: [
        object({ kind: { const: 'discard' } }),
        object({ kind: { const: 'hand' }, handId: id, owner }, [
          'kind',
          'handId',
        ]),
      ],
    },
    filter: object(
      {
        includeIds: array(cardId),
        excludeIds: array(cardId),
        attributes: cardAttributesSchema,
      },
      [],
    ),
    min: count,
    max: count,
    shortfall: { enum: ['reject', 'available'] },
    timeout: object({
      afterMs: { type: 'integer', minimum: 0, maximum: 86400000 },
      strategy: { enum: ['first', 'last', 'random'] },
    }),
    effects: array(ref('effect')),
    completeTurn: boolean,
  },
  ['choiceId', 'source', 'destination', 'min', 'max', 'shortfall'],
);

export function assertCardSelectionReferences(
  program: CardSelectionProgram,
  components: readonly GameComponentDefinition[],
  path = 'game.json.actions.selectCards',
): void {
  const fail = (field: string, reason: string): never => {
    throw new AuthoringError(
      `${path}.${field}`,
      reason,
      authoringValueAt(program, field),
    );
  };
  if (program.min > program.max) fail('min', 'inverted cardinality');
  const deck = components.find(
    (component) =>
      component.component === 'cards.deck' &&
      component.id === program.source.deckId,
  );
  if (deck?.component !== 'cards.deck')
    return fail('source.deckId', 'unknown deck');
  const cards = deck.catalog ?? deck.cards;
  const ids = new Set(
    cards.map((card) =>
      typeof card === 'object' && card !== null && 'id' in card
        ? card.id
        : card,
    ),
  );
  if (
    [...ids].some(
      (value) => typeof value !== 'string' && typeof value !== 'number',
    )
  )
    fail('source.deckId', 'identified cards required');
  for (const field of ['includeIds', 'excludeIds'] as const)
    for (const [index, value] of (program.filter?.[field] ?? []).entries())
      if (!ids.has(value))
        fail(`filter.${field}[${index}]`, 'unknown filter card');
  for (const property of Object.keys(program.filter?.attributes ?? {})) {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(property) ||
      ['__proto__', 'prototype', 'constructor'].includes(property)
    )
      fail(`filter.attributes.${property}`, 'unsafe filter property');
    if (
      !cards.some(
        (card) =>
          typeof card === 'object' &&
          card !== null &&
          'attributes' in card &&
          card.attributes !== null &&
          typeof card.attributes === 'object' &&
          Object.hasOwn(card.attributes, property),
      )
    )
      fail(
        `filter.attributes.${property}`,
        `unknown filter property: ${property}`,
      );
  }
  for (const field of ['source', 'destination'] as const) {
    const selection = program[field];
    if (selection.kind !== 'hand') continue;
    const handId = selection.handId;
    const hand = components.find(
      (component) =>
        component.component === 'cards.hands' && component.id === handId,
    );
    if (
      hand?.component !== 'cards.hands' ||
      hand.deck !== program.source.deckId
    )
      fail(`${field}.handId`, 'unknown or mismatched hand');
  }
}
