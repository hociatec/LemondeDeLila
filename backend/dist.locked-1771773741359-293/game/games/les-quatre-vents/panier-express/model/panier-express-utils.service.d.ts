import { GameStateEntity, PlayerStateEntity } from '../../../../core/entities/game-state.entity';
import { PanierExpressPlayer } from './panier-express-state.entity';
export declare class PanierExpressUtils {
    private static readonly COURSE_LABELS;
    private static readonly EVENT_LABELS;
    playerName(state: GameStateEntity, playerId: number): string;
    getPlayerName(state: GameStateEntity, playerId: number): string;
    getPlayer(state: GameStateEntity, playerId: number): PanierExpressPlayer | null;
    normalizePlayer(player: any): PanierExpressPlayer;
    normalizePlayers(players: any[] | undefined): PanierExpressPlayer[];
    toStringArray(value: unknown): string[];
    missingShoppingItems(player: PlayerStateEntity | null | undefined): Set<string>;
    getMissingItems(player: PanierExpressPlayer): Set<string>;
    hasCompletedShopping(player: PanierExpressPlayer): boolean;
    isBot(player: any): boolean;
    isGameInProgress(state: GameStateEntity): boolean;
    removeOne<T>(arr: T[], value: T): T[];
    formatCourseLabel(courseId: unknown): string;
    formatCourseLabels(list: Iterable<unknown> | null | undefined): string[];
    formatEventLabel(eventId: unknown): string;
    getTileLabel(tile: any): string;
}
