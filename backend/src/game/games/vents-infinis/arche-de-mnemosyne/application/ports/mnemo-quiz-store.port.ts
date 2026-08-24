import type {
  MnemoQuestionStatus,
  MnemoQuizCategory,
  MnemoQuizQuestion,
  MnemoQuizStoreData,
} from '../../model/mnemo-quiz.model';

export const MNEMO_QUIZ_STORE = Symbol('MNEMO_QUIZ_STORE');

export interface MnemoQuizStore {
  onModuleInit(): void;
  getSnapshot(): MnemoQuizStoreData;
  listCategories(): MnemoQuizCategory[];
  listQuestions(filter?: {
    categoryId?: string;
    status?: MnemoQuestionStatus;
  }): MnemoQuizQuestion[];
  createCategory(name: string): MnemoQuizCategory;
  renameCategory(categoryId: string, name: string): MnemoQuizCategory;
  deleteCategory(categoryId: string): void;
  createQuestion(input: {
    categoryId: string;
    question: string;
    correct: string;
    wrong1: string;
    wrong2: string;
    wrong3: string;
    status?: MnemoQuestionStatus;
  }): MnemoQuizQuestion;
  updateQuestion(
    questionId: string,
    patch: Partial<
      Pick<
        MnemoQuizQuestion,
        'question' | 'correct' | 'wrong1' | 'wrong2' | 'wrong3' | 'status'
      >
    >,
  ): MnemoQuizQuestion;
  deleteQuestion(questionId: string): void;
}
