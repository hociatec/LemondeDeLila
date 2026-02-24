import type { GameStateEntity, PlayerStateEntity } from '../core/entities/game-state.entity';
export declare function getSafePlayers(baseState: GameStateEntity): PlayerStateEntity[];
export declare function getRngMeta(metadata: {
    rng?: Record<string, unknown>;
} | null | undefined): Record<string, unknown>;
