import type { WebSocket } from 'ws';
export type RoomWsParams = {
    token: string | null;
    roomId: number;
    spectator: boolean;
    silent: boolean;
};
export declare function extractRoomWsParams(client: WebSocket, args: any[]): RoomWsParams;
