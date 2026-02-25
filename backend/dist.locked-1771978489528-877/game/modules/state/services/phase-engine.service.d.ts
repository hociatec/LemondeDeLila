import { GameStateEntity } from '../../../core/entities/game-state.entity';
export type PhaseDefinition<TMeta> = {
    id: string;
    canEnter?: (state: GameStateEntity, meta: TMeta) => boolean;
    onEnter?: (state: GameStateEntity, meta: TMeta) => GameStateEntity;
};
export declare class PhaseEngineService<TMeta = any> {
    private readonly logger;
    advance(state: GameStateEntity, meta: TMeta, phases: PhaseDefinition<TMeta>[], currentId: string, maxIterations?: number): {
        state: GameStateEntity;
        phaseId: string;
    };
}
