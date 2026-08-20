import type {
  MnemoQuestionStatus,
  MnemoQuizQuestion,
} from '../../../../game/games/vents-infinis/arche-de-mnemosyne/model/mnemo-quiz.model';

export interface ListAdminMnemoQuestionsQuery {
  categoryId?: string;
  status?: MnemoQuestionStatus;
}

export interface CreateAdminMnemoQuestionCommand {
  categoryId: string;
  question: string;
  answers: string[];
  correctIndex: number;
  status?: MnemoQuestionStatus;
}

export interface UpdateAdminMnemoQuestionCommand {
  id: string;
  categoryId?: string;
  question?: string;
  answers?: string[];
  correctIndex?: number;
  status?: MnemoQuestionStatus;
}

export type MnemoQuestionPatch = Partial<
  Pick<
    MnemoQuizQuestion,
    'question' | 'status' | 'correct' | 'wrong1' | 'wrong2' | 'wrong3'
  >
>;
