import type { WebSocket } from 'ws';
export declare class RoomRealtimeTrackerService {
    private readonly activePlayerSocketsByRoomId;
    private readonly participantRoomBySocket;
    setSocketParticipantRoom(socket: WebSocket, roomId: number | null): void;
    clearSocket(socket: WebSocket): void;
    private increment;
    private decrement;
    getActivePlayerRoomIds(): number[];
    hasActivePlayers(roomId: number): boolean;
    countActivePlayers(roomId: number): number;
}
