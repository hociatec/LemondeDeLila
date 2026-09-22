import type { QuizQuestion } from '../../../engine/sdk/public-api';
import type {
  SimultaneousQuizProgram,
  SimultaneousQuizSourceQuestion,
} from './program';

export function quizCatalog(program: SimultaneousQuizProgram) {
  const categories = program.categories
    .map((category) => ({ ...category }))
    .sort((left, right) => left.name.localeCompare(right.name, 'fr'));
  const validated = program.questions.filter(
    (question) => question.status === 'validated',
  );
  const questions = validated.map(toQuizQuestion);
  const banks = [
    { id: 'all', questions },
    ...categories.map((category) => ({
      id: category.id,
      questions: questions.filter(
        (_question, index) => validated[index]?.categoryId === category.id,
      ),
    })),
  ].filter((bank) => bank.questions.length > 0);
  const categoryIds = banks.map((bank) => bank.id);
  const categoryLabels = Object.fromEntries([
    ['all', 'Toutes les catégories'],
    ...categories
      .filter((category) => categoryIds.includes(category.id))
      .map((category) => [category.id, category.name]),
  ]) as Record<(typeof categoryIds)[number], string>;
  return { banks, categoryIds, categoryLabels };
}

function toQuizQuestion(
  question: SimultaneousQuizSourceQuestion,
): QuizQuestion {
  const choices = [
    question.correct,
    question.wrong1,
    question.wrong2,
    question.wrong3,
  ];
  const offset = stableOffset(question.id, choices.length);
  return {
    id: question.id,
    prompt: question.question,
    choices: [...choices.slice(offset), ...choices.slice(0, offset)],
    answerIndex: (choices.length - offset) % choices.length,
  };
}

function stableOffset(value: string, modulo: number): number {
  let hash = 0;
  for (const character of value)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash % modulo;
}
