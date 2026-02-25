import { Repository } from 'typeorm';
import type { WsSession } from '../../common/ws/ws-route-registry.service';
import { PayloadValidationService } from '../../common/validation/payload-validation.service';
import { NotificationService } from '../../notification/services/notification.service';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { RoomService } from '../services/room.service';
import { RoomInviteService } from '../services/room-invite.service';
import { CatalogService } from '../../catalog/services/catalog.service';
import { PublicRoomDirectoryService } from '../services/public-room-directory.service';
import { RoomRealtimeTrackerService } from '../services/room-realtime-tracker.service';
import { PresenceService } from '../../presence/services/presence.service';
export declare class RoomDirectoryWsHandler {
    private readonly validator;
    private readonly rooms;
    private readonly invites;
    private readonly notifications;
    private readonly catalog;
    private readonly directory;
    private readonly realtimeTracker;
    private readonly presence;
    private readonly roomRepo;
    private readonly participantRepo;
    constructor(validator: PayloadValidationService, rooms: RoomService, invites: RoomInviteService, notifications: NotificationService, catalog: CatalogService, directory: PublicRoomDirectoryService, realtimeTracker: RoomRealtimeTrackerService, presence: PresenceService, roomRepo: Repository<Room>, participantRepo: Repository<RoomParticipant>);
    listPublic(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            items: import("../utils/room-directory.utils").PublicRoomListItem[];
            groups: {
                gameType: string;
                rooms: import("../utils/room-directory.utils").PublicRoomListItem[];
            }[];
        };
    }>;
    joinPublic(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            roomId: number;
            room: {
                id: number;
                name: string;
                isPrivate: boolean;
                maxPlayers: number;
                status: string;
                gameType: string;
                startedAt?: Date | string | null;
                runId?: number | null;
                tableAmbienceSoundId?: string | null;
                counts: {
                    players: number;
                    spectators: number;
                };
                owner: {
                    id: number;
                    username: string;
                } | null;
                players: import("../dto/room-response.dto").RoomPlayer[];
                spectators: import("../dto/room-response.dto").RoomPlayer[];
                bots: import("../dto/room-response.dto").RoomBotState[];
            };
        };
    }>;
    leavePublic(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            roomId: number;
            deleted: boolean;
            room?: undefined;
        };
    } | {
        type: string;
        payload: {
            roomId: number;
            room: {
                id: number;
                name: string;
                isPrivate: boolean;
                maxPlayers: number;
                status: string;
                gameType: string;
                startedAt?: Date | string | null;
                runId?: number | null;
                tableAmbienceSoundId?: string | null;
                counts: {
                    players: number;
                    spectators: number;
                };
                owner: {
                    id: number;
                    username: string;
                } | null;
                players: import("../dto/room-response.dto").RoomPlayer[];
                spectators: import("../dto/room-response.dto").RoomPlayer[];
                bots: import("../dto/room-response.dto").RoomBotState[];
            };
            deleted?: undefined;
        };
    }>;
    spectatePublic(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            roomId: number;
            room: {
                id: number;
                name: string;
                isPrivate: boolean;
                maxPlayers: number;
                status: string;
                gameType: string;
                startedAt?: Date | string | null;
                runId?: number | null;
                tableAmbienceSoundId?: string | null;
                counts: {
                    players: number;
                    spectators: number;
                };
                owner: {
                    id: number;
                    username: string;
                } | null;
                players: import("../dto/room-response.dto").RoomPlayer[];
                spectators: import("../dto/room-response.dto").RoomPlayer[];
                bots: import("../dto/room-response.dto").RoomBotState[];
            };
        };
    }>;
    subscribePublic(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            items: import("../utils/room-directory.utils").PublicRoomListItem[];
            groups: {
                gameType: string;
                rooms: import("../utils/room-directory.utils").PublicRoomListItem[];
            }[];
        };
    }>;
    unsubscribePublic(session: WsSession): Promise<{
        type: string;
        payload: {
            ok: boolean;
        };
    }>;
    inviteSend(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            roomId: number;
            userId: number;
            alreadyInRoom: boolean;
            invitationId?: undefined;
            pending?: undefined;
            expiresAt?: undefined;
        };
    } | {
        type: string;
        payload: {
            invitationId: string;
            roomId: number;
            userId: number;
            pending: boolean;
            expiresAt: number;
            alreadyInRoom?: undefined;
        };
    } | {
        type: string;
        payload: {
            invitationId: string;
            roomId: number;
            userId: number;
            alreadyInRoom?: undefined;
            pending?: undefined;
            expiresAt?: undefined;
        };
    }>;
    invitePresenceList(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            roomId: number;
            players: {
                id: number;
                username: string;
                availability: import("../../presence/services/presence.service").PresenceAvailability | null;
                location: string | null;
                currentRoom: {
                    id: number;
                    name: string;
                } | null;
                pendingInvite: boolean;
            }[];
        };
    }>;
    inviteRespond(session: WsSession, payload: any): Promise<{
        type: string;
        payload: {
            invitationId: string;
            accepted: boolean;
            expired: boolean;
            roomId?: undefined;
            room?: undefined;
            spectator?: undefined;
        };
    } | {
        type: string;
        payload: {
            invitationId: string;
            accepted: boolean;
            expired?: undefined;
            roomId?: undefined;
            room?: undefined;
            spectator?: undefined;
        };
    } | {
        type: string;
        payload: {
            roomId: number;
            room: {
                id: number;
                name: string;
                isPrivate: boolean;
                maxPlayers: number;
                status: string;
                gameType: string;
                startedAt?: Date | string | null;
                runId?: number | null;
                tableAmbienceSoundId?: string | null;
                counts: {
                    players: number;
                    spectators: number;
                };
                owner: {
                    id: number;
                    username: string;
                } | null;
                players: import("../dto/room-response.dto").RoomPlayer[];
                spectators: import("../dto/room-response.dto").RoomPlayer[];
                bots: import("../dto/room-response.dto").RoomBotState[];
            };
            spectator: boolean;
            invitationId?: undefined;
            accepted?: undefined;
            expired?: undefined;
        };
    }>;
}
