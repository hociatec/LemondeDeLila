import { assertUniqueAuthorIds } from '../../../engine/runtime/contracts/authoring-diagnostics';
import { authoringValueAt } from '../../../engine/runtime/contracts/authoring-error';
import {
  authoringFailure,
  authoringProperty,
  type AuthoringFailure,
} from '../../../engine/runtime/contracts/authoring-diagnostics';
import type { BoardGameProgram } from './program';
import type { GameComponentDefinition } from '../../../engine/runtime/definitions/component-kit';
import {
  type AuthorSchema,
  authorId as id,
  authorInteger as integer,
  authorArray as array,
  authorObject as object,
  authorRecord as record,
} from '../../../engine/runtime/contracts/json-author-schema';

const positive: AuthorSchema = { type: 'integer', minimum: 1, maximum: 10000 };
const text: AuthorSchema = { type: 'string', maxLength: 65536 };
const landing: AuthorSchema = {
  oneOf: [
    object({ kind: { const: 'move' }, distance: integer }),
    object({
      kind: { const: 'random-move' },
      minimum: positive,
      maximum: positive,
      direction: { enum: [1, -1] },
    }),
    object({ kind: { const: 'choose-direction' }, distance: positive }),
    object({ kind: { const: 'skip' }, turns: positive }),
    object({ kind: { const: 'draw' }, deckId: id }),
    object({ kind: { const: 'collect' }, sourceId: id }, ['kind']),
    object({ kind: { const: 'quiz' } }),
    object({ kind: { const: 'nearest' }, tag: id }),
    object({ kind: { const: 'finish' }, reason: id }),
    object({
      kind: { const: 'finish-collection' },
      minimumScore: positive,
      reason: id,
    }),
  ],
};

export const jsonBoardSchema: AuthorSchema = object(
  {
    namespace: id,
    trackId: id,
    diceId: id,
    playingPhase: id,
    startingPlayer: { enum: ['first', 'random'] },
    maxDepth: { type: 'integer', minimum: 1, maximum: 64 },
    tiles: array(
      object(
        {
          id,
          label: text,
          description: text,
          tags: array(id),
          operations: array(landing),
        },
        ['id', 'label', 'description', 'operations'],
      ),
      1,
    ),
    scorePerForwardLap: positive,
    restoreDirection: object({ status: id, ruleId: id }),
    pawnSelection: object(
      {
        setId: id,
        choiceId: id,
        announceInventory: object({ inventoryId: id, eventType: id }),
      },
      ['setId', 'choiceId'],
    ),
    distribution: object({ inventoryId: id, groups: array(array(id, 1), 1) }),
    collection: object({
      requiredInventoryId: id,
      collectedInventoryId: id,
      overflowInventoryId: id,
      sources: record(array(id, 1)),
      defaultSourceId: id,
      collectedMessage: id,
      overflowMessage: id,
    }),
    quiz: object({ bankId: id, choiceId: id, correctMove: integer }),
    exchange: object({ inventoryId: id, takeChoiceId: id, giveChoiceId: id }),
    directionChoiceId: id,
    bindings: record({
      oneOf: [
        object({ kind: { const: 'move' } }),
        object({ kind: { const: 'collect' } }),
        object({ kind: { const: 'quiz' } }),
        object({ kind: { const: 'nearest' }, tag: id }),
        object({ kind: { const: 'exchange' } }),
      ],
    }),
  },
  [
    'namespace',
    'trackId',
    'diceId',
    'playingPhase',
    'startingPlayer',
    'maxDepth',
    'tiles',
    'bindings',
  ],
);

export function assertBoardReferences(
  program: BoardGameProgram,
  components: readonly GameComponentDefinition[],
  phases: Readonly<Record<string, { transitions?: readonly string[] }>>,
  initialPhase: string,
): void {
  const fail = authoringFailure('game.json.board', program, 'board: ');
  const component: ComponentLookup = (kind, id, field) => {
    const found = components.find((c) => c.component === kind && c.id === id);
    return found ?? fail(field, `unknown ${kind} ${id}`);
  };
  const track = component('movement.track', program.trackId, 'trackId');
  if (
    track.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('tiles', 'track size does not match tiles');
  component('dice.set', program.diceId, 'diceId');
  if (!Object.hasOwn(phases, program.playingPhase))
    fail('playingPhase', 'unknown playing phase');
  if (
    initialPhase !== program.playingPhase &&
    !phases[initialPhase]?.transitions?.includes(program.playingPhase)
  )
    fail('playingPhase', 'playing phase is not reachable from setup');
  assertUniqueAuthorIds(program.tiles, 'tiles', fail);
  const choices = [
    'directionChoiceId',
    'pawnSelection.choiceId',
    'quiz.choiceId',
    'exchange.takeChoiceId',
    'exchange.giveChoiceId',
  ];
  const seen = new Set<unknown>();
  for (const field of choices) {
    const id = authoringValueAt(program, field);
    if (id == null) continue;
    if (seen.has(id)) fail(field, 'duplicate board choice identifier');
    seen.add(id);
  }
  assertBoardCapabilities(program, component, fail);
  assertBoardOperations(program, component, fail);
}

type ComponentLookup = (
  kind: GameComponentDefinition['component'],
  id: string,
  field: string,
) => GameComponentDefinition;

function assertBoardCapabilities(
  program: BoardGameProgram,
  component: ComponentLookup,
  fail: AuthoringFailure,
): void {
  const inventory = (id: string, field: string) =>
    component('inventory.set', id, field);
  const assertItems = (
    definition: GameComponentDefinition,
    items: readonly string[],
    field: string,
  ) => {
    if (definition.component !== 'inventory.set' || !definition.items) return;
    for (const [i, item] of items.entries())
      if (!definition.items.includes(item))
        fail(`${field}[${i}]`, `unknown item in ${definition.id}`);
  };
  if (program.pawnSelection) {
    component('pawn.set', program.pawnSelection.setId, 'pawnSelection.setId');
    if (program.pawnSelection.announceInventory)
      inventory(
        program.pawnSelection.announceInventory.inventoryId,
        'pawnSelection.announceInventory.inventoryId',
      );
  }
  if (program.distribution) {
    const target = inventory(
      program.distribution.inventoryId,
      'distribution.inventoryId',
    );
    for (const [i, group] of program.distribution.groups.entries())
      assertItems(target, group, `distribution.groups[${i}]`);
  }
  if (program.quiz) component('quiz.bank', program.quiz.bankId, 'quiz.bankId');
  if (program.exchange)
    inventory(program.exchange.inventoryId, 'exchange.inventoryId');
  if (program.collection) {
    const c = program.collection;
    inventory(c.requiredInventoryId, 'collection.requiredInventoryId');
    const collected = inventory(
      c.collectedInventoryId,
      'collection.collectedInventoryId',
    );
    const overflow = inventory(
      c.overflowInventoryId,
      'collection.overflowInventoryId',
    );
    if (!Object.hasOwn(c.sources, c.defaultSourceId))
      fail('collection.defaultSourceId', 'unknown default collection source');
    for (const [key, items] of Object.entries(c.sources)) {
      const field = authoringProperty('collection.sources', key);
      assertItems(collected, items, field);
      assertItems(overflow, items, field);
    }
  }
}

function assertBoardOperations(
  program: BoardGameProgram,
  component: ComponentLookup,
  fail: AuthoringFailure,
): void {
  const tagged = (tag: string, field: string) => {
    if (!program.tiles.some((tile) => tile.tags?.includes(tag)))
      fail(field, `unknown destination tag ${tag}`);
  };
  for (const [i, tile] of program.tiles.entries())
    for (const [j, operation] of tile.operations.entries()) {
      const field = `tiles[${i}].operations[${j}]`;
      if (operation.kind === 'draw') {
        const deck = component(
          'cards.deck',
          operation.deckId,
          `${field}.deckId`,
        );
        if (
          deck.component !== 'cards.deck' ||
          deck.cards.some(
            (card) =>
              !card ||
              typeof card !== 'object' ||
              !('effects' in card) ||
              !Array.isArray(card.effects),
          )
        )
          fail(
            `${field}.deckId`,
            'drawn board cards must declare their effects',
          );
      }
      if (
        operation.kind === 'random-move' &&
        operation.minimum > operation.maximum
      )
        fail(`${field}.minimum`, 'inverted random movement range');
      if (operation.kind === 'choose-direction' && !program.directionChoiceId)
        fail('directionChoiceId', 'direction choice is required');
      if (operation.kind === 'quiz' && !program.quiz)
        fail('quiz', 'quiz is required');
      if (
        (operation.kind === 'collect' ||
          operation.kind === 'finish-collection') &&
        !program.collection
      )
        fail('collection', 'collection is required');
      if (
        operation.kind === 'collect' &&
        operation.sourceId &&
        !Object.hasOwn(program.collection?.sources ?? {}, operation.sourceId)
      )
        fail(`${field}.sourceId`, 'unknown collection source');
      if (operation.kind === 'nearest') tagged(operation.tag, `${field}.tag`);
    }
  for (const [key, binding] of Object.entries(program.bindings)) {
    if (binding.kind === 'collect' && !program.collection)
      fail('collection', 'collection is required');
    if (binding.kind === 'quiz' && !program.quiz)
      fail('quiz', 'quiz is required');
    if (binding.kind === 'exchange' && !program.exchange)
      fail('exchange', 'exchange is required');
    if (binding.kind === 'nearest')
      tagged(binding.tag, `${authoringProperty('bindings', key)}.tag`);
  }
}
