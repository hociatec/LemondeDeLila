import {
  authoringFailure,
  assertUniqueAuthorValues,
  authoringProperty,
} from '../../../engine/runtime/contracts/authoring-diagnostics';
import type { ParadeProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/runtime/definitions/component-kit';
import {
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorNumber as number,
  authorObject as object,
  authorRecord as record,
} from '../../../engine/runtime/contracts/json-author-schema';

export const jsonParadeSchema = object({
  deckId: id,
  handId: id,
  cards: array(
    object({
      id,
      name: { type: 'string', minLength: 1, maxLength: 2000 },
      value: id,
      special: boolean,
    }),
    1,
  ),
  sequence: array(id, 1),
  rewards: record(record(number)),
  resourceValues: record(number),
  finishReason: id,
  eventNamespace: id,
});

export function assertParadeReferences(
  program: ParadeProgram,
  components: readonly GameComponentDefinition[],
  resources: ReadonlySet<string>,
): void {
  const fail = authoringFailure('game.json.parade', program, 'Parade: ');
  const deck = components.find(
    (component) =>
      component.component === 'cards.deck' && component.id === program.deckId,
  );
  const hand = components.find(
    (component) =>
      component.component === 'cards.hands' && component.id === program.handId,
  );
  if (deck?.component !== 'cards.deck') fail('deckId', 'unknown deck');
  if (hand?.component !== 'cards.hands' || hand.deck !== program.deckId)
    fail('handId', 'unknown hand or mismatched deck');
  const values = new Set(program.cards.map((card) => card.value));
  for (const field of ['id', 'value'] as const)
    assertUniqueAuthorValues(
      program.cards.map((card) => card[field]),
      (i) => `cards[${i}].${field}`,
      fail,
    );
  assertUniqueAuthorValues(program.sequence, (i) => `sequence[${i}]`, fail);
  for (const [i, value] of program.sequence.entries())
    if (!values.has(value)) fail(`sequence[${i}]`, 'unknown card value');
  if (program.sequence.length !== values.size)
    fail('sequence', 'sequence must reference every card value exactly once');
  for (const [value, reward] of Object.entries(program.rewards)) {
    const path = authoringProperty('rewards', value);
    if (!values.has(value)) fail(path, `unknown reward value ${value}`);
    for (const resource of Object.keys(reward))
      if (!resources.has(resource))
        fail(
          authoringProperty(path, resource),
          `unknown reward resource ${resource}`,
        );
  }
  for (const resource of Object.keys(program.resourceValues))
    if (!resources.has(resource))
      fail(
        authoringProperty('resourceValues', resource),
        `unknown scored resource ${resource}`,
      );
}
