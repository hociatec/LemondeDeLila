type PendingMoveOption = {
    pawnIndex: number;
    targetProgress: number;
};
export type PendingMoveData = {
    data?: {
        moves?: unknown;
    };
};
export type MovePayload = {
    pawnIndex?: unknown;
    targetProgress?: unknown;
};
export declare function getPendingPawnMoveOptions(pending: PendingMoveData | null | undefined): PendingMoveOption[];
export declare function listPendingPawnMoveActions(pending: PendingMoveData | null | undefined, actionType?: string): Array<{
    type: string;
    payload: {
        pawnIndex: number;
        targetProgress: number;
    };
}>;
export declare function resolvePendingPawnMove(pending: PendingMoveData | null | undefined, payload: MovePayload): PendingMoveOption | null;
export {};
