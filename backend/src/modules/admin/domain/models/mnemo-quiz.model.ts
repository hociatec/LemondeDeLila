export type MnemoQuestionStatus = 'validated' | 'pending' | 'to_edit' | 'trash';

export type MnemoQuizCategory = { id: string; name: string };

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
