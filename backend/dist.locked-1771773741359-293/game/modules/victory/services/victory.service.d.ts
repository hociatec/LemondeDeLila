import type { ModuleOverviewDto } from '../../dto/generic-module.dto';
import { GameStateEntity } from '../../../core/entities/game-state.entity';
export type VictoryCheckResult = {
    finished: boolean;
    winnerId?: number | string | null;
    details?: Record<string, unknown>;
};
export type VictoryCondition = {
    id: string;
    description?: string;
    check: (state: GameStateEntity) => VictoryCheckResult | boolean;
};
export declare class VictoryService {
    checkCriteria(state: GameStateEntity, checks: Array<(s: GameStateEntity) => boolean>): boolean;
    evaluate(state: GameStateEntity, conditions: VictoryCondition[]): (VictoryCheckResult & {
        conditionId: string;
    }) | null;
    getOverview(): ModuleOverviewDto;
}
