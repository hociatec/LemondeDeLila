import { Injectable } from '@nestjs/common';
import type { PhaseDefinition as GamePhase } from '../../../models/game-definition.model';
import type { GameStateEntity } from '../../../models/game-state.model';
import {
  PhaseEngineService,
  type PhaseDefinition,
} from './phase-engine.service';

export type PhaseEnterHook<TMeta, TPhaseId extends string> = (params: {
  state: GameStateEntity;
  meta: TMeta;
  phaseId: TPhaseId;
}) => GameStateEntity;

@Injectable()
export class GamePhaseOrchestratorService {
  constructor(
    private readonly phases: PhaseEngineService<string, GameStateEntity, unknown>,
  ) {}

  advance<TMeta, TPhaseId extends string>(params: {
    state: GameStateEntity;
    meta: TMeta;
    phaseOrder: readonly GamePhase<TPhaseId>[];
    currentPhaseId: TPhaseId;
    canEnter?: (
      state: GameStateEntity,
      meta: TMeta,
      phaseId: TPhaseId,
    ) => boolean;
    onEnterSystemPhase?: PhaseEnterHook<TMeta, TPhaseId>;
    maxIterations?: number;
  }): { state: GameStateEntity; phaseId: TPhaseId } {
    const {
      state,
      meta,
      phaseOrder,
      currentPhaseId,
      canEnter,
      onEnterSystemPhase,
      maxIterations,
    } = params;

    const definitions: PhaseDefinition<TMeta>[] = (phaseOrder ?? []).map(
      (phase) => ({
        id: phase.id,
        canEnter: canEnter ? (s, m) => canEnter(s, m, phase.id) : undefined,
        onEnter:
          phase.kind === 'system' && onEnterSystemPhase
            ? (s, m) =>
                onEnterSystemPhase({ state: s, meta: m, phaseId: phase.id })
            : undefined,
      }),
    );

    const result = this.phases.advance(
      state,
      meta,
      definitions,
      String(currentPhaseId),
      maxIterations,
    );
    return { state: result.state, phaseId: result.phaseId as TPhaseId };
  }
}
