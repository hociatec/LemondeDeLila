import type { PendingState } from '../../../core/entities/game-state.entity';
type LandingTile = {
    type?: string | null;
    label?: string | null;
    description?: string | null;
};
type DrawPolicy = {
    log: string;
    pendingLabel: string;
    data?: Record<string, unknown>;
};
export declare class BoardEffectsPoliciesService {
    formatTileLabel(position: number, rawLabel: unknown): string;
    createPlacementLog(params: {
        playerLabel: string;
        pawnLabel: string;
        position: number;
        tileLabel: string;
    }): string;
    resolveLanding(params: {
        position: number;
        tile?: LandingTile | null;
        playerId: number;
        drawPolicies?: Record<string, DrawPolicy>;
        finishTypes?: string[];
        defaultNeutralLog?: string | null;
    }): {
        logs: string[];
        pending: PendingState | null;
        isFinish: boolean;
    };
}
export {};
