import { TileEffectRegistryService } from './tile-effect-registry.service';
export type StandEffectContext<TState = any> = {
    state: TState;
    playerId: number;
    standId: string;
};
export declare class StandEffectRegistryService<TState = any> {
    private readonly tiles;
    constructor(tiles: TileEffectRegistryService<TState, StandEffectContext<TState>>);
    registerStand(type: string, handler: (state: TState, ctx: StandEffectContext<TState>) => TState): void;
    applyStand(type: string, state: TState, ctx: StandEffectContext<TState>): TState;
}
