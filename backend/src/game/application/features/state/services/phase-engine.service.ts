import { Injectable, Logger } from '@nestjs/common';
import { GameStateEntity } from '../../../models/game-state.model';

export type PhaseDefinition<TMeta> = {
  id: string;
  canEnter?: (state: GameStateEntity, meta: TMeta) => boolean;
  onEnter?: (state: GameStateEntity, meta: TMeta) => GameStateEntity;
};

@Injectable()
export class PhaseEngineService<TMeta = unknown> {
  private readonly logger = new Logger(PhaseEngineService.name);

  advance(
    state: GameStateEntity,
    meta: TMeta,
    phases: PhaseDefinition<TMeta>[],
    currentId: string,
    maxIterations = 20,
  ): { state: GameStateEntity; phaseId: string } {
    if (!phases.length) return { state, phaseId: currentId };
    const idxStart = Math.max(
      0,
      phases.findIndex((p) => p.id === currentId),
    );
    let idx = idxStart;
    let iter = 0;
    let next = state;
    while (iter++ < maxIterations) {
      const phase = phases[idx] ?? phases[0];
      if (!phase.canEnter || phase.canEnter(next, meta)) {
        next = phase.onEnter ? phase.onEnter(next, meta) : next;
        return { state: next, phaseId: phase.id };
      }
      idx = (idx + 1) % phases.length;
    }
    this.logger.warn(
      `PhaseEngine: boucle detectee apres ${maxIterations} iterations (phase=${currentId})`,
    );
    return { state: next, phaseId: currentId };
  }
}
