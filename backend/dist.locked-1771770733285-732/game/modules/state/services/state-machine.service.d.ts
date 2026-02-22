export type PhaseStep<TState> = {
    id: string;
    canEnter?: (state: TState) => boolean;
    onEnter?: (state: TState) => TState;
};
export declare class StateMachineService<TState = any> {
    private readonly logger;
    advance(state: TState, steps: PhaseStep<TState>[], currentStepId: string, maxIterations?: number): {
        state: TState;
        stepId: string;
    };
}
