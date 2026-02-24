import type { RoomPlayer } from '../dto/room-response.dto';
export type ClientMetaLike = {
    roomId: number;
    role: 'participant' | 'spectator';
    silent: boolean;
    userId: number;
    username: string;
};
export declare function listVisibleSpectators(clients: Iterable<ClientMetaLike>, roomId: number): RoomPlayer[];
export declare function listConnectedPlayers(clients: Iterable<ClientMetaLike>, roomId: number): RoomPlayer[];
export declare function mergePlayers(dbPlayers: RoomPlayer[] | null | undefined, connectedPlayers: RoomPlayer[] | null | undefined): RoomPlayer[];
export declare function addHiddenSelf(spectators: RoomPlayer[], hiddenSelf: {
    userId: number;
    username: string;
} | null | undefined): RoomPlayer[];
