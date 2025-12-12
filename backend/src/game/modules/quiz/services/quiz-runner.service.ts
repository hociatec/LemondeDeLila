import { Injectable } from '@nestjs/common';

export type QuizQuestion = { id: string; question: string; answer: string; choices?: string[] };
export type QuizState = { pending: Record<number, QuizQuestion | undefined> };

@Injectable()
export class QuizRunnerService {
  setPending(state: QuizState, playerId: number, question: QuizQuestion): QuizState {
    return { ...state, pending: { ...(state.pending ?? {}), [playerId]: question } };
  }

  clearPending(state: QuizState, playerId: number): QuizState {
    const next = { ...(state.pending ?? {}) };
    delete next[playerId];
    return { ...state, pending: next };
  }

  validateAnswer(state: QuizState, playerId: number, answer: string): { correct: boolean; state: QuizState } {
    const q = (state.pending ?? {})[playerId];
    if (!q) {
      return { correct: false, state };
    }
    const correct = q.answer?.trim().toLowerCase() === (answer ?? '').trim().toLowerCase();
    const next = this.clearPending(state, playerId);
    return { correct, state: next };
  }
}
