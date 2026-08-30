import type { GameRng } from '../../../core/application/contracts/game-execution-context.model';
import {
  GameConfigurationError,
  GameNotFoundError,
  GameRuleViolationError,
  GameStateViolationError,
} from '../../../core/domain/errors/game-domain.errors';
import type { EventVisibility } from '../../../core/application/contracts/game-event.model';

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
  readonly autoReveal?: 'all-answered' | 'manual';
  readonly scoring?: { correct: number; incorrect?: number };
};

export type QuizSessionState = {
  id: string;
  bankId: string;
  questionId: string;
  participantPlayerIds: number[];
  answers: Record<string, number>;
  phase: 'answering' | 'revealed' | 'closed';
  correctAnswerIndex?: number;
  scored: boolean;
};

export type QuizSession = QuizSessionState & {
  question: Omit<QuizQuestion, 'answerIndex'>;
};

export type QuizKitState = {
  orders: Record<string, string[]>;
  cursors: Record<string, number>;
  sessions: Record<string, QuizSessionState>;
  sequence: number;
};

export const quiz = {
  bank(definition: Omit<QuizDefinition, 'component'>): QuizDefinition {
    const questionIds = definition.questions.map((question) =>
      question.id.trim(),
    );
    if (
      questionIds.some((questionId) => questionId.length === 0) ||
      new Set(questionIds).size !== questionIds.length
    ) {
      throw new GameConfigurationError(
        `Identifiants de questions invalides: ${definition.id}`,
      );
    }
    for (const question of definition.questions) {
      if (
        question.choices.length < 2 ||
        !Number.isInteger(question.answerIndex) ||
        question.answerIndex < 0 ||
        question.answerIndex >= question.choices.length
      ) {
        throw new GameConfigurationError(
          `Question de quiz invalide: ${question.id}`,
        );
      }
    }
    return deepFreeze({
      ...definition,
      component: 'quiz.bank',
      questions: structuredClone(definition.questions),
    });
  },
};

export class GameQuizController {
  constructor(
    private readonly state: QuizKitState,
    private readonly random: GameRng,
    definitions: readonly QuizDefinition[] = [],
    private readonly emit: (
      type: string,
      data: Record<string, unknown>,
      visibility?: EventVisibility,
    ) => void = () => {},
    private readonly addScore: (
      playerId: number,
      amount: number,
    ) => void = () => {},
  ) {
    for (const definition of definitions) {
      this.definitions.set(definition.id, definition);
    }
  }

  private readonly definitions = new Map<string, QuizDefinition>();

  create(definition: QuizDefinition): void {
    this.definitions.set(definition.id, definition);
    const questionIds = definition.questions.map((question) => question.id);
    this.state.orders[definition.id] = definition.shuffle
      ? this.random.shuffle(questionIds)
      : questionIds;
    this.state.cursors[definition.id] = 0;
  }

  reset(bankId: string): void {
    this.definitions.delete(bankId);
    delete this.state.orders[bankId];
    delete this.state.cursors[bankId];
    for (const [sessionId, session] of Object.entries(this.state.sessions)) {
      if (session.bankId === bankId) delete this.state.sessions[sessionId];
    }
  }

  assertValid(): void {
    for (const [bankId, order] of Object.entries(this.state.orders)) {
      const definition = this.definitions.get(bankId);
      const known = new Set(
        definition?.questions.map((question) => question.id),
      );
      if (
        !definition ||
        new Set(order).size !== order.length ||
        order.some((questionId) => !known.has(questionId)) ||
        (this.state.cursors[bankId] ?? 0) < 0 ||
        (this.state.cursors[bankId] ?? 0) > order.length
      ) {
        throw new GameStateViolationError('Ordre de quiz invalide', { bankId });
      }
    }
    for (const [sessionId, session] of Object.entries(this.state.sessions)) {
      const definition = this.definitions.get(session.bankId);
      const question = definition?.questions.find(
        (candidate) => candidate.id === session.questionId,
      );
      if (
        !question ||
        Object.values(session.answers).some(
          (answer) =>
            !Number.isInteger(answer) ||
            answer < 0 ||
            answer >= question.choices.length,
        )
      ) {
        throw new GameStateViolationError('Session de quiz invalide', {
          sessionId,
          bankId: session.bankId,
        });
      }
    }
  }

  next(bankId: string): Omit<QuizQuestion, 'answerIndex'> | null {
    const definition = this.definition(bankId);
    const order = this.state.orders[bankId] ?? [];
    const cursor = this.state.cursors[bankId] ?? 0;
    const questionId = order[cursor];
    const question = definition.questions.find(
      (candidate) => candidate.id === questionId,
    );
    if (!question) return null;
    this.state.cursors[bankId] = cursor + 1;
    const { answerIndex: _answerIndex, ...publicQuestion } = question;
    return publicQuestion;
  }

  check(bankId: string, questionId: string, answerIndex: number): boolean {
    const question = this.definition(bankId).questions.find(
      (candidate) => candidate.id === questionId,
    );
    if (!question) {
      throw new GameNotFoundError(`Question inconnue: ${questionId}`);
    }
    return question.answerIndex === answerIndex;
  }

  ask(
    bankId: string,
    participantPlayerIds: readonly number[],
    options: { sessionId?: string } = {},
  ): QuizSession | null {
    const question = this.next(bankId);
    if (!question) return null;
    this.state.sequence += 1;
    const session: QuizSessionState = {
      id: options.sessionId ?? `${bankId}:${this.state.sequence}`,
      bankId,
      questionId: question.id,
      participantPlayerIds: [...new Set(participantPlayerIds)],
      answers: {},
      phase: 'answering',
      scored: false,
    };
    this.state.sessions[session.id] = session;
    this.emit('quiz.asked', {
      sessionId: session.id,
      bankId,
      questionId: question.id,
      participantPlayerIds: [...session.participantPlayerIds],
    });
    return this.publicSession(session);
  }

  answer(
    sessionId: string,
    playerId: number,
    answerIndex: number,
  ): { correct: boolean; revealed: boolean; allAnswered: boolean } {
    const session = this.requireSession(sessionId);
    if (session.phase !== 'answering') {
      throw new GameRuleViolationError('QUIZ_NOT_ANSWERING', { sessionId });
    }
    if (!session.participantPlayerIds.includes(playerId)) {
      throw new GameRuleViolationError('QUIZ_PLAYER_NOT_EXPECTED', {
        sessionId,
        playerId,
      });
    }
    if (session.answers[String(playerId)] != null) {
      throw new GameRuleViolationError('QUIZ_ALREADY_ANSWERED', {
        sessionId,
        playerId,
      });
    }
    const question = this.question(session.bankId, session.questionId);
    if (
      !Number.isInteger(answerIndex) ||
      answerIndex < 0 ||
      answerIndex >= question.choices.length
    ) {
      throw new GameRuleViolationError('QUIZ_ANSWER_INVALID', {
        sessionId,
        answerIndex,
      });
    }
    session.answers[String(playerId)] = answerIndex;
    const correct = question.answerIndex === answerIndex;
    this.emit(
      'quiz.answered',
      { sessionId, playerId },
      {
        kind: 'split',
        privateDataByPlayer: { [String(playerId)]: { answerIndex } },
      },
    );
    const allAnswered = session.participantPlayerIds.every(
      (participantId) => session.answers[String(participantId)] != null,
    );
    const autoReveal =
      this.definition(session.bankId).autoReveal ?? 'all-answered';
    if (allAnswered && autoReveal === 'all-answered') this.reveal(sessionId);
    return {
      correct,
      revealed: this.requireSession(sessionId).phase === 'revealed',
      allAnswered,
    };
  }

  reveal(sessionId: string): QuizSession {
    const session = this.requireSession(sessionId);
    if (session.phase === 'closed') {
      throw new GameRuleViolationError('QUIZ_SESSION_CLOSED', { sessionId });
    }
    if (session.phase !== 'revealed') {
      const question = this.question(session.bankId, session.questionId);
      session.phase = 'revealed';
      session.correctAnswerIndex = question.answerIndex;
      this.score(session);
      this.emit('quiz.revealed', {
        sessionId,
        questionId: question.id,
        correctAnswerIndex: question.answerIndex,
        answers: structuredClone(session.answers),
      });
    }
    return this.publicSession(session);
  }

  advance(sessionId: string): QuizSession | null {
    const session = this.requireSession(sessionId);
    this.close(sessionId);
    return this.ask(session.bankId, session.participantPlayerIds);
  }

  close(sessionId: string): void {
    const session = this.requireSession(sessionId);
    if (session.phase === 'answering') this.reveal(sessionId);
    if (session.phase === 'closed') return;
    session.phase = 'closed';
    this.emit('quiz.closed', { sessionId });
  }

  session(sessionId: string): QuizSession | null {
    const session = this.state.sessions[sessionId];
    return session ? this.publicSession(session) : null;
  }

  private definition(bankId: string): QuizDefinition {
    const definition = this.definitions.get(bankId);
    if (!definition) throw new GameNotFoundError(`Quiz inconnu: ${bankId}`);
    return definition;
  }

  private question(bankId: string, questionId: string): QuizQuestion {
    const question = this.definition(bankId).questions.find(
      (candidate) => candidate.id === questionId,
    );
    if (!question)
      throw new GameNotFoundError(`Question inconnue: ${questionId}`);
    return question;
  }

  private requireSession(sessionId: string): QuizSessionState {
    const session = this.state.sessions[sessionId];
    if (!session)
      throw new GameNotFoundError(`Session quiz inconnue: ${sessionId}`);
    return session;
  }

  private score(session: QuizSessionState): void {
    const scoring = this.definition(session.bankId).scoring;
    if (!scoring || session.scored) return;
    const question = this.question(session.bankId, session.questionId);
    const deltas: Record<string, number> = {};
    for (const playerId of session.participantPlayerIds) {
      const delta =
        session.answers[String(playerId)] === question.answerIndex
          ? scoring.correct
          : (scoring.incorrect ?? 0);
      if (delta !== 0) this.addScore(playerId, delta);
      deltas[String(playerId)] = delta;
    }
    session.scored = true;
    this.emit('quiz.scored', { sessionId: session.id, deltas });
  }

  private publicSession(session: QuizSessionState): QuizSession {
    const { answerIndex: _answerIndex, ...question } = this.question(
      session.bankId,
      session.questionId,
    );
    return { ...structuredClone(session), question: structuredClone(question) };
  }
}

function deepFreeze<TValue>(value: TValue): TValue {
  if (value == null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

export function createQuizKitState(): QuizKitState {
  return { orders: {}, cursors: {}, sessions: {}, sequence: 0 };
}
