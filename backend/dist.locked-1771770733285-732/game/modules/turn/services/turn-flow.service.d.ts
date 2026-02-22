import { GameStateEntity } from '../../../core/entities/game-state.entity';
import { TurnService } from './turn.service';
import { TurnPoliciesService } from '../../turn-policies/services/turn-policies.service';
export interface AdvanceTurnOptions {
    skipAnnouncement?: boolean;
    playerNameResolver?: (state: GameStateEntity, playerId: number) => string;
}
export declare class TurnFlowService {
    private readonly turns;
    private readonly turnPolicies;
    constructor(turns: TurnService, turnPolicies: TurnPoliciesService);
    advanceTurn(state: GameStateEntity, options?: AdvanceTurnOptions): GameStateEntity;
}
