export type QuizQuestion = {
    id: string;
    question: string;
    answer: string;
    choices?: string[];
};
export type QuizState = {
    pending: Record<number, QuizQuestion | undefined>;
};
export declare class QuizRunnerService {
    setPending(state: QuizState, playerId: number, question: QuizQuestion): QuizState;
    clearPending(state: QuizState, playerId: number): QuizState;
    validateAnswer(state: QuizState, playerId: number, answer: string): {
        correct: boolean;
        state: QuizState;
    };
}
