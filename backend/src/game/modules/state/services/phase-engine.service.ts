import { Injectable, Logger } from '@nestjs/common';
import { GameStateEntity } from '../../../core/entities/game-state.entity';

export type PhaseDefinition<TMeta> = {
  id: string;
  canEnter?: (state: GameStateEntity, meta: TMeta) => boolean;
  onEnter?: (state: GameStateEntity, meta: TMeta) => GameStateEntity;
};

@Injectable()
export class PhaseEngineService<TMeta = any> {
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
      `PhaseEngine: boucle détectée après ${maxIterations} itérations (phase=${currentId})`,
    );
    return { state: next, phaseId: currentId };
  }
}
