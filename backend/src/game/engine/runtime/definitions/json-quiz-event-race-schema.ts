import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';
import type { QuizEventRaceProgram } from '../effect-packs/race-quiz-event-track/program';
import {
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';
import type { GameComponentDefinition } from './component-kit';

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
  const fail = (reason: string): never => {
    throw new GameConfigurationError(`QuizEvent race: ${reason}`);
  };
  const track = components.find(
    (item) =>
      item.component === 'movement.track' && item.id === program.trackId,
  );
  if (
    track?.component !== 'movement.track' ||
    track.spaces !== program.tiles.length
  )
    fail('one tile per track position required');
  for (const deckId of [
    program.questionDeckId,
    program.challengeDeckId,
    program.eventDeckId,
  ])
    if (
      !components.some(
        (item) => item.component === 'cards.deck' && item.id === deckId,
      )
    )
      fail(`unknown deck ${deckId}`);
  if (
    !components.some(
      (item) => item.component === 'dice.set' && item.id === program.diceId,
    )
  )
    fail('unknown dice');
  if (program.tiles.some((tile, index) => tile.n !== index + 1))
    fail('invalid tile order');
  if (
    program.tiles[0]?.type !== 'start' ||
    program.tiles.at(-1)?.type !== 'finish'
  )
    fail('invalid track endpoints');
  for (const tile of program.tiles)
    if (
      tile.type === 'goto' &&
      (tile.target == null || tile.target > program.tiles.length)
    )
      fail(`invalid destination on tile ${tile.n}`);
  for (const card of [...program.questions, ...program.challenges])
    if (card.correctIndex >= card.choices.length)
      fail('answer outside choices');
}
