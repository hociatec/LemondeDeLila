import type { QuizQuestion } from '../../../engine/sdk/public-api';
import {
  cardContent,
  defineGameContent,
  gameInput,
  quizContent,
  rejectContent,
} from '../../../engine/sdk/public-api';
import manifest from './manifest.json';
import embeddedQuiz from './quiz.json';

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

const defaultCategories: MnemoCategory[] = embeddedQuiz.categories.map(
  (category) => ({ id: category.id, name: category.name }),
);

const sourceQuestions: SourceQuestion[] = embeddedQuiz.questions.filter(
  (question) => question.status === 'validated',
);

const defaultQuestions: QuizQuestion[] = sourceQuestions.map((question) =>
  toQuizQuestion(question),
);

const defaultBanks = [
  { id: 'all', questions: defaultQuestions },
  ...defaultCategories.map((category) => ({
    id: category.id,
    questions: sourceQuestions
      .filter((question) => question.categoryId === category.id)
      .map((question) => toQuizQuestion(question)),
  })),
].filter((bank) => bank.questions.length > 0);

const idSchema = gameInput.string({ min: 1, max: 128 });
const questionSchema = gameInput.object({
  id: idSchema,
  prompt: gameInput.string({ min: 1, max: 4000 }),
  choices: gameInput.array(gameInput.string({ min: 1, max: 2000 }), {
    min: 2,
    max: 20,
  }),
  answerIndex: gameInput.number({ integer: true, min: 0, max: 19 }),
});
const mnemoSchema = gameInput.object({
  categories: gameInput.array(
    gameInput.object({
      id: idSchema,
      name: gameInput.string({ min: 1, max: 200 }),
    }),
    { min: 1, max: 1000 },
  ),
  quizBanks: gameInput.array(
    gameInput.object({
      id: idSchema,
      questions: gameInput.array(questionSchema, { min: 1, max: 100000 }),
    }),
    { min: 1, max: 1001 },
  ),
});
export const MNEMO_GAME_CONTENT = defineGameContent(
  manifest.code,
  { categories: defaultCategories, quizBanks: defaultBanks },
  {
    schema: {
      parse(value: unknown) {
        const parsed = mnemoSchema.parse(value);
        const categories = cardContent(parsed.categories);
        const banks = cardContent(parsed.quizBanks).map((bank) => ({
          id: bank.id,
          questions: quizContent(bank.questions),
        }));
        const all = banks.find((bank) => bank.id === 'all');
        if (!all || categories.some((category) => category.id === 'all'))
          rejectContent('Catalogue global de quiz invalide');
        const questions = new Map(
          all.questions.map((question) => [question.id, question]),
        );
        for (const bank of banks) {
          if (bank.id === 'all') continue;
          if (!categories.some((category) => category.id === bank.id))
            rejectContent('Catégorie de quiz inconnue');
          for (const question of bank.questions) {
            const canonical = questions.get(question.id);
            if (
              !canonical ||
              canonical.prompt !== question.prompt ||
              canonical.answerIndex !== question.answerIndex ||
              canonical.choices.length !== question.choices.length ||
              canonical.choices.some(
                (choice, index) => choice !== question.choices[index],
              )
            )
              rejectContent('Question différente du catalogue global');
          }
        }
        return { categories, quizBanks: banks };
      },
    },
  },
);
export const MNEMO_BANKS = MNEMO_GAME_CONTENT.data.quizBanks;
const globalBank = MNEMO_BANKS.find((bank) => bank.id === 'all');
if (!globalBank) rejectContent('Catalogue global de quiz absent');

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
