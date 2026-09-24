import {
  authoringFailure,
  assertUniqueAuthorValues,
} from '../../../engine/sdk/extension-api';
import type { SimultaneousQuizProgram } from './program';
import {
  type AuthorSchema,
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorObject as object,
} from '../../../engine/sdk/extension-api';

const score = { type: 'integer', minimum: -50, maximum: 50 } as const;
export const jsonSimultaneousQuizSchema: AuthorSchema = object(
  {
    categories: array(
      object({ id, name: { type: 'string', minLength: 1, maxLength: 200 } }, [
        'id',
        'name',
      ]),
      1,
    ),
    questions: array(
      object(
        {
          id,
          categoryId: id,
          question: { type: 'string', minLength: 1, maxLength: 4000 },
          correct: { type: 'string', minLength: 1, maxLength: 2000 },
          wrong1: { type: 'string', minLength: 1, maxLength: 2000 },
          wrong2: { type: 'string', minLength: 1, maxLength: 2000 },
          wrong3: { type: 'string', minLength: 1, maxLength: 2000 },
          status: id,
          createdAt: { type: 'string', maxLength: 128 },
          updatedAt: { type: 'string', maxLength: 128 },
        },
        [
          'id',
          'categoryId',
          'question',
          'correct',
          'wrong1',
          'wrong2',
          'wrong3',
          'status',
        ],
      ),
      1,
    ),
    defaults: object(
      {
        categoryId: id,
        questionsPerRound: { type: 'integer', minimum: 1, maximum: 50 },
        targetPoints: { type: 'integer', minimum: 1, maximum: 200 },
        useTimer: boolean,
        timerSeconds: { type: 'integer', minimum: 5, maximum: 300 },
        interQuestionSeconds: { type: 'integer', minimum: 0, maximum: 60 },
        correctSoloPoints: score,
        correctMultiPoints: score,
        wrongPoints: score,
        timeoutPoints: score,
      },
      [
        'categoryId',
        'questionsPerRound',
        'targetPoints',
        'useTimer',
        'timerSeconds',
        'interQuestionSeconds',
        'correctSoloPoints',
        'correctMultiPoints',
        'wrongPoints',
        'timeoutPoints',
      ],
    ),
  },
  ['categories', 'questions', 'defaults'],
);

export function assertSimultaneousQuizReferences(
  program: SimultaneousQuizProgram,
): void {
  const fail = authoringFailure('game.json.simultaneousQuiz', program);
  const categoryIds = program.categories.map((category) => category.id);
  assertUniqueAuthorValues(categoryIds, (i) => `categories[${i}].id`, fail);
  categoryIds.forEach((id, i) => {
    if (id === 'all')
      fail(`categories[${i}].id`, 'reserved category identifier');
  });
  const allowed = new Set(categoryIds);
  if (!program.questions.some((question) => question.status === 'validated'))
    fail('questions', 'at least one validated question required');
  for (const [i, question] of program.questions.entries())
    if (question.status === 'validated' && !allowed.has(question.categoryId))
      fail(`questions[${i}].categoryId`, 'unknown category');
}
