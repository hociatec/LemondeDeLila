export type MnemoQuestionStatus =
  | 'validated'
  | 'pending'
  | 'to_edit'
  | 'trash';

export type MnemoQuizCategory = {
  id: string;
  name: string;
};

export type MnemoQuizQuestion = {
  id: string;
  categoryId: string;
  question: string;
  correct: string;
  wrong1: string;
  wrong2: string;
  wrong3: string;
  status: MnemoQuestionStatus;
  createdAt: string;
  updatedAt: string;
};

export type MnemoQuizStoreData = {
  categories: MnemoQuizCategory[];
  questions: MnemoQuizQuestion[];
};

export type MnemoQuizConfig = {
  targetPoints: number;
  useTimer: boolean;
  timerSeconds: number;
};

export type MnemoCurrentQuestion = {
  id: string;
  categoryId: string;
  question: string;
  choices: string[];
  correctChoice: string;
};

export type MnemoAdminPage =
  | { page: 'setup' }
  | { page: 'categories' }
  | { page: 'category'; categoryId: string }
  | { page: 'questions'; categoryId: string; status: MnemoQuestionStatus }
  | { page: 'question'; categoryId: string; questionId: string };

export type MnemoPrompt =
  | null
  | {
      type: 'text_prompt';
      title: string;
      label: string;
      actionType: string;
      payloadKey: string;
      initialText?: string;
      cancelActionType?: string;
    }
  | {
      type: 'config_prompt';
      title: string;
      actionType: string;
      fields: Array<{
        key: string;
        label: string;
        kind?: 'text' | 'number' | 'bool';
        initialText?: string;
      }>;
      cancelActionType?: string;
    };

export type MnemoQuizMetadata = {
  config: MnemoQuizConfig;
  selectedCategoryId: string | null;
  scoresByPlayerId: Record<number, number>;
  usedQuestionIds: string[];
  currentQuestion: MnemoCurrentQuestion | null;
  adminView: MnemoAdminPage;
  prompt: MnemoPrompt;
  winnerId: number | null;
};

