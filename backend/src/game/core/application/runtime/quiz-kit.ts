import type { GameRng } from '../models/game-execution-context.model';

export type QuizQuestion = {
  id: string;
  prompt: string;
  choices: readonly string[];
  answerIndex: number;
};

export type QuizDefinition = {
  readonly component: 'quiz.bank';
  readonly id: string;
  readonly questions: readonly QuizQuestion[];
  readonly shuffle?: boolean;
};

export type QuizKitState = {
  banks: Record<string, QuizQuestion[]>;
  cursors: Record<string, number>;
};

export const quiz = {
  bank(definition: Omit<QuizDefinition, 'component'>): QuizDefinition {
    for (const question of definition.questions) {
      if (
        question.choices.length < 2 ||
        !Number.isInteger(question.answerIndex) ||
        question.answerIndex < 0 ||
        question.answerIndex >= question.choices.length
      ) {
        throw new Error(`Question de quiz invalide: ${question.id}`);
      }
    }
    return Object.freeze({ ...definition, component: 'quiz.bank' });
  },
};

export class GameQuizController {
  constructor(
    private readonly state: QuizKitState,
    private readonly random: GameRng,
  ) {}

  create(definition: QuizDefinition): void {
    const questions = structuredClone(definition.questions) as QuizQuestion[];
    this.state.banks[definition.id] = definition.shuffle
      ? this.random.shuffle(questions)
      : questions;
    this.state.cursors[definition.id] = 0;
  }

  next(bankId: string): Omit<QuizQuestion, 'answerIndex'> | null {
    const questions = this.state.banks[bankId] ?? [];
    const cursor = this.state.cursors[bankId] ?? 0;
    const question = questions[cursor];
    if (!question) return null;
    this.state.cursors[bankId] = cursor + 1;
    const { answerIndex: _answerIndex, ...publicQuestion } = question;
    return publicQuestion;
  }

  check(bankId: string, questionId: string, answerIndex: number): boolean {
    const question = this.state.banks[bankId]?.find(
      (candidate) => candidate.id === questionId,
    );
    if (!question) throw new Error(`Question inconnue: ${questionId}`);
    return question.answerIndex === answerIndex;
  }
}

export function createQuizKitState(): QuizKitState {
  return { banks: {}, cursors: {} };
}
