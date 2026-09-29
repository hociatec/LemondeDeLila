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
export const bounceQuizRacePatternSchema = object({
  kind: { const: 'bounce-quiz-race' },
  rollRecipe: id,
  trackId: id,
  diceId: id,
  deckId: id,
  pawnSetId: id,
  pawnChoiceId: id,
  answerChoiceId: id,
  maxDepth: positive,
  finishReason: id,
  statuses: object({
    ignoreNextMalus: id,
    ignoreNextSkip: id,
    forceDrawNextTurn: id,
  }),
  tiles: array(
    object({
      n: positive,
      title: text,
      description: text,
      type: { enum: ['start', 'neutral', 'card', 'move', 'skip', 'finish'] },
      delta: integer,
      skipTurns: { type: 'integer', minimum: 0, maximum: 1000 },
    }),
    2,
  ),
  cards: array(
    object(
      {
        id: positive,
        title: text,
        description: text,
        effects: array(ref('effect')),
        quiz: object(
          {
            prompt: text,
            choices: array(text, 3),
            correctIndex: { type: 'integer', minimum: 0, maximum: 100 },
            successDelta: integer,
            failureDelta: integer,
            anyCorrect: boolean,
          },
          ['prompt', 'choices', 'correctIndex', 'successDelta', 'failureDelta'],
        ),
      },
      ['id', 'title', 'effects'],
    ),
    1,
  ),
});
