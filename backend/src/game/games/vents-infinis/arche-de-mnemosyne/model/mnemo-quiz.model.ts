export type MnemoQuestionStatus = 'validated' | 'pending' | 'to_edit' | 'trash';

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
  interQuestionSeconds?: number;

  // Barème
  correctSoloPoints: number;
  correctMultiPoints: number;
  wrongPoints: number;
  timeoutPoints: number;
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
  | { page: 'all_questions'; status: MnemoQuestionStatus | 'all' }
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
        // Compat client: some UIs expect "boolean" rather than "bool".
        kind?: 'text' | 'number' | 'bool' | 'boolean';
        initialText?: string;
      }>;
      cancelActionType?: string;
    };

export type MnemoQuizMetadata = {
  rng?: Record<string, any>;
  ownerPlayerId?: number | null;
  config: MnemoQuizConfig;
  selectedCategoryId: string | null;
  scoresByPlayerId: Record<number, number>;
  usedQuestionIds: string[];
  currentQuestion: MnemoCurrentQuestion | null;
  quizAnswersByPlayerId: Record<number, number>;
  quizDeadlineAtMs?: number | null;
  interQuestionUntilMs?: number | null;
  adminView: MnemoAdminPage;
  prompt: MnemoPrompt;
  promptOwnerId?: number | null;
  winnerId: number | null;
};
