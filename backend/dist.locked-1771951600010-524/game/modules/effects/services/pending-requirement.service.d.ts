export type PendingRequirement<TPayload = unknown> = {
    playerId: number;
    type: string;
    payload?: TPayload;
};
export declare class PendingRequirementService<TPayload = unknown> {
    private readonly pending;
    set(req: PendingRequirement<TPayload>): void;
    get(playerId: number): PendingRequirement<TPayload> | undefined;
    clear(playerId: number): void;
}
