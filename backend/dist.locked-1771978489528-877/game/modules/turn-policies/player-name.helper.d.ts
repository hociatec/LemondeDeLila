import type { GameStateEntity } from '../../core/entities/game-state.entity';
type PlayerLike = {
    id?: number | string;
    username?: string | null;
} | null | undefined;
export interface ResolvePlayerNameOptions {
    coerceNumericIds?: boolean;
    collapseWhitespace?: boolean;
    unwrapDoubleQuotes?: boolean;
}
export declare function resolvePlayerName(players: GameStateEntity['players'] | PlayerLike[] | null | undefined, playerId: number, options?: ResolvePlayerNameOptions): string;
export declare function resolvePlayerNameFromState(state: Pick<GameStateEntity, 'players'> | null | undefined, playerId: number, options?: ResolvePlayerNameOptions): string;
export {};
