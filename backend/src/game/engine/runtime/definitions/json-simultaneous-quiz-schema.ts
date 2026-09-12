import type { SimultaneousQuizProgram } from '../effect-packs/choice-simultaneous-quiz/program';
import {
  type AuthorSchema,
  authorArray as array,
  authorBoolean as boolean,
  authorId as id,
  authorObject as object,
} from '../contracts/json-author-schema';

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
  const categoryIds = program.categories.map((category) => category.id);
  if (
    new Set(categoryIds).size !== categoryIds.length ||
    categoryIds.includes('all')
  )
    throw new Error(
      'SimultaneousQuiz category identifiers must be unique and exclude all',
    );
  const allowed = new Set(categoryIds);
  if (!program.questions.some((question) => question.status === 'validated'))
    throw new Error('SimultaneousQuiz requires validated questions');
  if (
    program.questions.some(
      (question) =>
        question.status === 'validated' && !allowed.has(question.categoryId),
    )
  )
    throw new Error('SimultaneousQuiz question references an unknown category');
}
