import type {
  MnemoQuestionStatus,
  MnemoQuizCategory,
  MnemoQuizQuestion,
  MnemoQuizStoreData,
} from '../../domain/models/mnemo-quiz.model';

export type MnemoQuestionInput = Omit<
  MnemoQuizQuestion,
  'id' | 'createdAt' | 'updatedAt'
>;

export type MnemoQuestionPatch = Partial<
  Pick<
    MnemoQuizQuestion,
    | 'categoryId'
    | 'question'
    | 'correct'
    | 'wrong1'
    | 'wrong2'
    | 'wrong3'
    | 'status'
  >
>;

export interface AdminMnemoQuizStorePort {
  getSnapshot(): MnemoQuizStoreData;
  listCategories(): MnemoQuizCategory[];
  listQuestions(filter?: {
    categoryId?: string;
    status?: MnemoQuestionStatus;
  }): MnemoQuizQuestion[];
  createCategory(name: string): MnemoQuizCategory;
  renameCategory(categoryId: string, name: string): MnemoQuizCategory;
  deleteCategory(categoryId: string): void;
  createQuestion(input: MnemoQuestionInput): MnemoQuizQuestion;
  updateQuestion(
    questionId: string,
    patch: MnemoQuestionPatch,
  ): MnemoQuizQuestion;
  deleteQuestion(questionId: string): void;
}

export const ADMIN_MNEMO_QUIZ_STORE_PORT = Symbol(
  'ADMIN_MNEMO_QUIZ_STORE_PORT',
);
