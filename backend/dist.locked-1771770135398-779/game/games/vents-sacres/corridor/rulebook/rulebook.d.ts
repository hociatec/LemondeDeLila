import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { CorridorMetadata, CorridorPos, CorridorWallOrientation } from '../model/corridor.model';
export type CorridorWall = {
    x: number;
    y: number;
    o: CorridorWallOrientation;
};
export declare function getMetadata(state: GameStateEntity): CorridorMetadata;
export declare function clampInt(n: any): number;
export declare function isInside(size: number, pos: CorridorPos): boolean;
export declare function key(x: number, y: number): string;
export declare function parseKey(k: string): {
    x: number;
    y: number;
} | null;
export declare function getPawnPos(meta: CorridorMetadata, playerId: number): CorridorPos;
export declare function isOccupied(meta: CorridorMetadata, pos: CorridorPos): boolean;
export declare function wallSets(meta: CorridorMetadata): {
    h: Set<string>;
    v: Set<string>;
};
export declare function isEdgeBlocked(meta: CorridorMetadata, from: CorridorPos, to: CorridorPos): boolean;
export declare function listLegalPawnMoves(state: GameStateEntity, actorId: number): CorridorPos[];
export declare function isWinningPos(state: GameStateEntity, playerId: number, pos: CorridorPos): boolean;
export declare function isWallPlacementInBounds(meta: CorridorMetadata, wall: CorridorWall): boolean;
export declare function overlapsOrCrosses(meta: CorridorMetadata, wall: CorridorWall): boolean;
export declare function hasPathToGoal(meta: CorridorMetadata, start: CorridorPos, goalY: number): boolean;
export declare function shortestDistanceToGoal(meta: CorridorMetadata, start: CorridorPos, goalY: number): number | null;
export declare function wouldBlockAllPaths(state: GameStateEntity, meta: CorridorMetadata, wall: CorridorWall): boolean;
export declare function applyWall(meta: CorridorMetadata, wall: CorridorWall): CorridorMetadata;
export declare function listLegalWallPlacements(state: GameStateEntity, actorId: number): CorridorWall[];
export declare function validateMoveAction(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): {
    to: CorridorPos;
    actorId: number;
};
export declare function validatePlaceWallAction(state: GameStateEntity, action: GameSingleActionDto, actorId: number | null): {
    wall: CorridorWall;
    actorId: number;
};
