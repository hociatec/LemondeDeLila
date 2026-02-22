import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { PhaseDefinition as GamePhase } from '../../../engine/model/game-definition.model';
import { PhaseEngineService } from './phase-engine.service';
export type PhaseEnterHook<TMeta, TPhaseId extends string> = (params: {
    state: GameStateEntity;
    meta: TMeta;
    phaseId: TPhaseId;
}) => GameStateEntity;
export declare class GamePhaseOrchestratorService {
    private readonly phases;
    constructor(phases: PhaseEngineService<any>);
    advance<TMeta, TPhaseId extends string>(params: {
        state: GameStateEntity;
        meta: TMeta;
        phaseOrder: readonly GamePhase<TPhaseId>[];
        currentPhaseId: TPhaseId;
        canEnter?: (state: GameStateEntity, meta: TMeta, phaseId: TPhaseId) => boolean;
        onEnterSystemPhase?: PhaseEnterHook<TMeta, TPhaseId>;
        maxIterations?: number;
    }): {
        state: GameStateEntity;
        phaseId: TPhaseId;
    };
}
