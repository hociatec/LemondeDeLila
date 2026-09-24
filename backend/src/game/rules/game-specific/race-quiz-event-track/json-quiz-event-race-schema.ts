import { authoringFailure } from '../../../engine/sdk/extension-api';
import type { QuizEventRaceProgram } from './program';
import {
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../../../engine/sdk/extension-api';
import type { GameComponentDefinition } from '../../../engine/sdk/extension-api';

const integer = { type: 'integer', minimum: -10000, maximum: 10000 } as const;
const text = { type: 'string', minLength: 1, maxLength: 10000 } as const;
const choiceCard = object({
  id: positive,
  title: text,
  prompt: text,
  choices: array(text, 2),
  correctIndex: { type: 'integer', minimum: 0, maximum: 100 },
  correctDelta: integer,
  wrongDelta: integer,
});

export const jsonQuizEventRaceSchema = object({
  trackId: id,
  diceId: id,
  questionDeckId: id,
  challengeDeckId: id,
  eventDeckId: id,
  answerChoiceId: id,
  eventMoveChoiceId: id,
  tiles: array(
    object(
      {
        n: positive,
        title: text,
        type: {
          enum: [
            'start',
            'neutral',
            'question',
            'challenge',
            'event',
            'move',
            'skip',
            'finish',
            'swapNearest',
            'goto',
          ],
        },
        delta: integer,
        turnsToSkip: positive,
        target: positive,
        keepTurn: boolean,
      },
      ['n', 'title', 'type'],
    ),
    2,
  ),
  questions: array(choiceCard, 1),
  challenges: array(choiceCard, 1),
  events: array(
    object(
      {
        id: positive,
        title: text,
        description: text,
        effects: array(ref('effect')),
        moveDeltas: array(integer),
      },
      ['id', 'title', 'description', 'effects'],
    ),
    1,
  ),
  maxDepth: positive,
  finishReason: id,
});

export function assertQuizEventRaceReferences(
  program: QuizEventRaceProgram,
  components: readonly GameComponentDefinition[],
): void {
  const fail = authoringFailure(
    'game.json.quizEventRace',
    program,
    'QuizEvent race: ',
  );
  const track = components.find(
    (item) =>
      item.component === 'movement.track' && item.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('trackId', 'one tile per track position required');
  for (const field of [
    'questionDeckId',
    'challengeDeckId',
    'eventDeckId',
  ] as const)
    if (
      !components.some(
        (item) => item.component === 'cards.deck' && item.id === program[field],
      )
    )
      fail(field, `unknown deck ${program[field]}`);
  if (
    !components.some(
      (item) => item.component === 'dice.set' && item.id === program.diceId,
    )
  )
    fail('diceId', 'unknown dice');
  for (const [i, tile] of program.tiles.entries())
    if (tile.n !== i + 1) fail(`tiles[${i}].n`, 'invalid tile order');
  if (program.tiles[0]?.type !== 'start')
    fail('tiles[0].type', 'invalid start tile');
  if (program.tiles.at(-1)?.type !== 'finish')
    fail(`tiles[${program.tiles.length - 1}].type`, 'invalid finish tile');
  for (const [i, tile] of program.tiles.entries())
    if (
      tile.type === 'goto' &&
      (tile.target == null || tile.target > program.tiles.length)
    )
      fail(`tiles[${i}].target`, `invalid destination on tile ${tile.n}`);
  for (const field of ['questions', 'challenges'] as const)
    for (const [index, card] of program[field].entries())
      if (card.correctIndex >= card.choices.length)
        fail(`${field}[${index}].correctIndex`, 'answer outside choices');
}
