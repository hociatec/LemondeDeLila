type PendingPawnOption = {
    id: string;
    label: string;
};
export type PendingPawnPayload = {
    type?: unknown;
    playerId?: unknown;
    data?: {
        pawns?: unknown;
    };
};
export type PendingPawnChoicePayload = {
    pawnId?: unknown;
    pawn?: unknown;
    value?: unknown;
};
type NormalizeFn = (value: string) => string;
export declare function isPendingPawnForPlayer(pending: PendingPawnPayload | null | undefined, playerId: number | null, pendingType?: string): boolean;
export declare function getPendingPawnOptions(pending: PendingPawnPayload | null | undefined): PendingPawnOption[];
export declare function listPendingPawnActions(pending: PendingPawnPayload | null | undefined, actionType: string): Array<{
    type: string;
    payload: {
        pawnId: string;
    };
}>;
export declare function resolvePendingPawnId(pending: PendingPawnPayload | null | undefined, payload: PendingPawnChoicePayload, normalize?: NormalizeFn): string | null;
export {};
