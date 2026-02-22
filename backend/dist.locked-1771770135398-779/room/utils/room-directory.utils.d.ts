import { Room } from '../entities/room.entity';
export type PublicRoomListItem = {
    id: number;
    name: string;
    gameType: string;
    status: string;
    started: boolean;
    spectatorOnly: boolean;
    banned?: boolean;
    maxPlayers: number;
    playersCount: number;
    botsCount: number;
    owner: {
        id: number;
        username: string;
    } | null;
};
export declare function buildPublicRoomList(rooms: Room[], opts?: {
    allowedGameTypes?: ReadonlySet<string>;
}): {
    items: PublicRoomListItem[];
    groups: {
        gameType: string;
        rooms: PublicRoomListItem[];
    }[];
};
