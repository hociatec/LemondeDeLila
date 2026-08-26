import {
  freezeGameContent,
  rejectContent,
} from '../../../core/application/public-api';
import quizContent from './quiz.json';
import type { QuizQuestion } from '../../../core/application/public-api';

export type MnemoCategory = { id: string; name: string };

type SourceQuestion = {
  id: string;
  categoryId: string;
  question: string;
  correct: string;
  wrong1: string;
  wrong2: string;
  wrong3: string;
  status: string;
};

export const MNEMO_CATEGORIES: MnemoCategory[] = quizContent.categories.map(
  (category) => ({ id: category.id, name: category.name }),
);

const sourceQuestions: SourceQuestion[] = quizContent.questions.filter(
  (question) => question.status === 'validated',
);

export const MNEMO_QUESTIONS: QuizQuestion[] = sourceQuestions.map((question) =>
  toQuizQuestion(question),
);

export const MNEMO_BANKS = [
  { id: 'all', questions: MNEMO_QUESTIONS },
  ...MNEMO_CATEGORIES.map((category) => ({
    id: category.id,
    questions: sourceQuestions
      .filter((question) => question.categoryId === category.id)
      .map((question) => toQuizQuestion(question)),
  })),
].filter((bank) => bank.questions.length > 0);

function toQuizQuestion(question: SourceQuestion): QuizQuestion {
  const choices = [
    question.correct,
    question.wrong1,
    question.wrong2,
    question.wrong3,
  ];
  if (choices.some((choice) => choice.trim().length === 0))
    rejectContent(`Réponse Mnémosyne vide: ${question.id}`);
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

freezeGameContent(MNEMO_CATEGORIES);
freezeGameContent(MNEMO_QUESTIONS);
freezeGameContent(MNEMO_BANKS);
