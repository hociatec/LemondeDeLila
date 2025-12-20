import { Injectable, Logger } from '@nestjs/common';

export type PhaseStep<TState> = {
  id: string;
  canEnter?: (state: TState) => boolean;
  onEnter?: (state: TState) => TState;
};

@Injectable()
export class StateMachineService<TState = any> {
  private readonly logger = new Logger(StateMachineService.name);

  advance(
    state: TState,
    steps: PhaseStep<TState>[],
    currentStepId: string,
    maxIterations = 20,
  ): { state: TState; stepId: string } {
    if (!steps.length) {
      return { state, stepId: currentStepId };
    }
    const stepIndex = steps.findIndex((s) => s.id === currentStepId);
    let idx = stepIndex >= 0 ? stepIndex : 0;
    let iter = 0;
    const nextState = state;
    while (iter++ < maxIterations) {
      const step = steps[idx] ?? steps[0];
      if (!step.canEnter || step.canEnter(nextState)) {
        const updated = step.onEnter ? step.onEnter(nextState) : nextState;
        return { state: updated, stepId: step.id };
      }
      idx = (idx + 1) % steps.length;
    }
    this.logger.warn(
      `StateMachine: boucle détectée après ${maxIterations} itérations (step=${currentStepId})`,
    );
    return { state: nextState, stepId: currentStepId };
  }
}
