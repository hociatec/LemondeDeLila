import type { BoardGameProgram } from '../contracts/board-game-program';
import type { GameComponentDefinition } from './component-kit';
import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import {
  type AuthorSchema,
  authorId as id,
  authorInteger as integer,
  authorArray as array,
  authorObject as object,
  authorRecord as record,
} from '../contracts/json-author-schema';

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
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`board: ${reason}`);
  };
  const component = (
    kind: GameComponentDefinition['component'],
    id: string,
  ) => {
    const found = components.find((c) => c.component === kind && c.id === id);
    return found ?? fail(`unknown ${kind} ${id}`);
  };
  const track = component('movement.track', program.trackId);
  if (
    track.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('track size does not match tiles');
  component('dice.set', program.diceId);
  if (!Object.hasOwn(phases, program.playingPhase))
    fail('unknown playing phase');
  if (
    initialPhase !== program.playingPhase &&
    !phases[initialPhase]?.transitions?.includes(program.playingPhase)
  )
    fail('playing phase is not reachable from setup');
  const ids = program.tiles.map((t) => t.id);
  if (new Set(ids).size !== ids.length) fail('duplicate tile identifier');
  const choiceIds = [
    program.directionChoiceId,
    program.pawnSelection?.choiceId,
    program.quiz?.choiceId,
    program.exchange?.takeChoiceId,
    program.exchange?.giveChoiceId,
  ].filter((id): id is string => id != null);
  if (new Set(choiceIds).size !== choiceIds.length)
    fail('duplicate board choice identifier');
  assertBoardCapabilities(program, component, fail);
  assertBoardOperations(program, component, fail);
}

type ComponentLookup = (
  kind: GameComponentDefinition['component'],
  id: string,
) => GameComponentDefinition;
type BoardFailure = (reason: string) => never;

function assertBoardCapabilities(
  program: BoardGameProgram,
  component: ComponentLookup,
  fail: BoardFailure,
): void {
  const inventory = (id: string) => component('inventory.set', id);
  const assertItems = (inventoryId: string, items: readonly string[]) => {
    const definition = inventory(inventoryId);
    if (
      definition.component === 'inventory.set' &&
      definition.items &&
      items.some((item) => !definition.items?.includes(item))
    )
      fail(`unknown item in ${inventoryId}`);
  };
  if (program.pawnSelection) {
    component('pawn.set', program.pawnSelection.setId);
    if (program.pawnSelection.announceInventory)
      inventory(program.pawnSelection.announceInventory.inventoryId);
  }
  if (program.distribution)
    for (const group of program.distribution.groups)
      assertItems(program.distribution.inventoryId, group);
  if (program.quiz) component('quiz.bank', program.quiz.bankId);
  if (program.exchange) inventory(program.exchange.inventoryId);
  if (program.collection) {
    const c = program.collection;
    inventory(c.requiredInventoryId);
    inventory(c.collectedInventoryId);
    inventory(c.overflowInventoryId);
    if (!Object.hasOwn(c.sources, c.defaultSourceId))
      fail('unknown default collection source');
    for (const items of Object.values(c.sources)) {
      assertItems(c.collectedInventoryId, items);
      assertItems(c.overflowInventoryId, items);
    }
  }
}

function assertBoardOperations(
  program: BoardGameProgram,
  component: ComponentLookup,
  fail: BoardFailure,
): void {
  const tagged = (tag: string) => {
    if (!program.tiles.some((tile) => tile.tags?.includes(tag)))
      fail(`unknown destination tag ${tag}`);
  };
  for (const tile of program.tiles)
    for (const operation of tile.operations) {
      if (operation.kind === 'draw') {
        const deck = component('cards.deck', operation.deckId);
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
          fail('drawn board cards must declare their effects');
      }
      if (
        operation.kind === 'random-move' &&
        operation.minimum > operation.maximum
      )
        fail('inverted random movement range');
      if (operation.kind === 'choose-direction' && !program.directionChoiceId)
        fail('direction choice is required');
      if (operation.kind === 'quiz' && !program.quiz) fail('quiz is required');
      if (
        (operation.kind === 'collect' ||
          operation.kind === 'finish-collection') &&
        !program.collection
      )
        fail('collection is required');
      if (
        operation.kind === 'collect' &&
        operation.sourceId &&
        !Object.hasOwn(program.collection?.sources ?? {}, operation.sourceId)
      )
        fail('unknown collection source');
      if (operation.kind === 'nearest') tagged(operation.tag);
    }
  for (const binding of Object.values(program.bindings)) {
    if (binding.kind === 'collect' && !program.collection)
      fail('collection is required');
    if (binding.kind === 'quiz' && !program.quiz) fail('quiz is required');
    if (binding.kind === 'exchange' && !program.exchange)
      fail('exchange is required');
    if (binding.kind === 'nearest') tagged(binding.tag);
  }
}
