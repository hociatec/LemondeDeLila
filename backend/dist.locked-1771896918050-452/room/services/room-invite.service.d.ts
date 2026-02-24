export type RoomInvite = {
    id: string;
    roomId: number;
    fromUserId: number;
    toUserId: number;
    createdAt: number;
    expiresAt: number;
    consumedAt?: number | null;
};
export declare class RoomInviteService {
    private readonly invites;
    private readonly ttlMs;
    create(roomId: number, fromUserId: number, toUserId: number): RoomInvite;
    get(id: string): RoomInvite | null;
    findActive(roomId: number, toUserId: number): RoomInvite | null;
    consume(id: string, opts?: {
        keep?: boolean;
    }): RoomInvite | null;
    delete(id: string): void;
    canSpectate(roomId: number, userId: number): boolean;
    private cleanupExpired;
}
