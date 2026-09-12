import type { CardSelectionProgram } from '../extensions/card-selection/program';
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
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

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
): void {
  const fail = (reason: string): never => {
    throw new GameConfigurationError(
      `card selection ${program.choiceId}: ${reason}`,
    );
  };
  if (program.min > program.max) fail('inverted cardinality');
  const deck = components.find(
    (component) =>
      component.component === 'cards.deck' &&
      component.id === program.source.deckId,
  );
  if (deck?.component !== 'cards.deck') return fail('unknown deck');
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
    fail('identified cards required');
  for (const value of [
    ...(program.filter?.includeIds ?? []),
    ...(program.filter?.excludeIds ?? []),
  ])
    if (!ids.has(value)) fail('unknown filter card');
  for (const property of Object.keys(program.filter?.attributes ?? {})) {
    if (
      !/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(property) ||
      ['__proto__', 'prototype', 'constructor'].includes(property)
    )
      fail('unsafe filter property');
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
      fail(`unknown filter property: ${property}`);
  }
  for (const handId of [
    program.source.kind === 'hand' ? program.source.handId : null,
    program.destination.kind === 'hand' ? program.destination.handId : null,
  ]) {
    if (handId === null) continue;
    const hand = components.find(
      (component) =>
        component.component === 'cards.hands' && component.id === handId,
    );
    if (
      hand?.component !== 'cards.hands' ||
      hand.deck !== program.source.deckId
    )
      fail('unknown or mismatched hand');
  }
}
