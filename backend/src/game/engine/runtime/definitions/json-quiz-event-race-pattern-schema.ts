import {
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorObject as object,
  authorPositive as positive,
  authorRef as ref,
} from '../contracts/json-author-schema';

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

export const quizEventRacePatternSchema = object({
  kind: { const: 'quiz-event-race' },
  rollRecipe: id,
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
        description: text,
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
