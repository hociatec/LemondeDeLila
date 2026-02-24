import type { PendingState } from '../../../core/entities/game-state.entity';
import type { FrousseMetadata } from './model/frousse.types';
type PlayerLike = {
    id?: number;
    pawn?: unknown;
} | null | undefined;
export declare function buildPawnSelectionPending(players: PlayerLike[], meta: FrousseMetadata): PendingState | null;
export {};
