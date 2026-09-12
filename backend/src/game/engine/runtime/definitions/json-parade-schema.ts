import type { ParadeProgram } from '../effect-packs/cards-ordered-parade/program';
import type { GameComponentDefinition } from './component-kit';
import {
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorNumber as number,
  authorObject as object,
  authorRecord as record,
} from '../contracts/json-author-schema';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

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
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`Parade: ${reason}`);
  };
  const deck = components.find(
    (component) =>
      component.component === 'cards.deck' && component.id === program.deckId,
  );
  const hand = components.find(
    (component) =>
      component.component === 'cards.hands' && component.id === program.handId,
  );
  if (deck?.component !== 'cards.deck') fail('unknown deck');
  if (hand?.component !== 'cards.hands' || hand.deck !== program.deckId)
    fail('unknown hand or mismatched deck');
  const ids = new Set(program.cards.map((card) => card.id));
  const values = new Set(program.cards.map((card) => card.value));
  if (ids.size !== program.cards.length || values.size !== program.cards.length)
    fail('card ids and values must be unique');
  if (
    new Set(program.sequence).size !== program.sequence.length ||
    program.sequence.length !== values.size ||
    program.sequence.some((value) => !values.has(value))
  )
    fail('sequence must reference every card value exactly once');
  for (const [value, reward] of Object.entries(program.rewards)) {
    if (!values.has(value)) fail(`unknown reward value ${value}`);
    for (const resource of Object.keys(reward))
      if (!resources.has(resource)) fail(`unknown reward resource ${resource}`);
  }
  for (const resource of Object.keys(program.resourceValues))
    if (!resources.has(resource)) fail(`unknown scored resource ${resource}`);
}
