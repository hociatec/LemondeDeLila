import type { GameStateEntity } from '../../../core/entities/game-state.entity';
import type { InteractiveExchangeAdapter, InteractiveExchangePending } from '../model/interactive-exchange.model';
import { RandomService } from '../../random/services/random.service';
export type InteractiveExchangeStartResult = {
    kind: 'started';
    state: GameStateEntity;
    pending: InteractiveExchangePending;
} | {
    kind: 'blocked';
    state: GameStateEntity;
} | {
    kind: 'no_inventory';
    state: GameStateEntity;
} | {
    kind: 'no_targets';
    state: GameStateEntity;
};
export type InteractiveExchangeChooseTargetResult = {
    kind: 'updated';
    state: GameStateEntity;
    pending: InteractiveExchangePending;
} | {
    kind: 'invalid';
    state: GameStateEntity;
};
export type InteractiveExchangeChooseGiveResult = {
    kind: 'offered';
    state: GameStateEntity;
    offer: Extract<InteractiveExchangePending, {
        step: 'confirm';
    }>;
} | {
    kind: 'invalid';
    state: GameStateEntity;
};
export declare class InteractiveExchangeService {
    private readonly random;
    constructor(random: RandomService);
    start(state: GameStateEntity, playerId: number, card: string, adapter: InteractiveExchangeAdapter): InteractiveExchangeStartResult;
    chooseTarget(state: GameStateEntity, playerId: number, targetPlayerId: number, adapter: InteractiveExchangeAdapter): InteractiveExchangeChooseTargetResult;
    chooseGive(state: GameStateEntity, playerId: number, give: string, adapter: InteractiveExchangeAdapter): InteractiveExchangeChooseGiveResult;
    acceptOffer(state: GameStateEntity, targetPlayerId: number, adapter: InteractiveExchangeAdapter): {
        kind: 'resolved';
        state: GameStateEntity;
        offer: Extract<InteractiveExchangePending, {
            step: 'confirm';
        }>;
    } | {
        kind: 'invalid';
        state: GameStateEntity;
    };
    refuseOffer(state: GameStateEntity, targetPlayerId: number): GameStateEntity;
    private pickRandomFromArray;
}
