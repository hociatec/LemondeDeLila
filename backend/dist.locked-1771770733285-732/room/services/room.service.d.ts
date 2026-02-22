import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { Room } from '../entities/room.entity';
import { RoomParticipant } from '../entities/room-participant.entity';
import { User } from '../../user/entities/user.entity';
import { VaultRoomSnapshotEntity } from '../../vault/entities/vault-room-snapshot.entity';
import { RoomPayload } from '../dto/room-response.dto';
import { BotService } from '../../bot/services/bot.service';
import { PresenceService } from '../../presence/services/presence.service';
import { CatalogService } from '../../catalog/services/catalog.service';
import { GameStatsService } from '../../stats/services/game-stats.service';
import { RoomRealtimeTrackerService } from './room-realtime-tracker.service';
import { RedisClientFactory } from '../../common/redis/redis-client.factory';
export declare class RoomService {
    private readonly rooms;
    private readonly participants;
    private readonly vaultSnapshots;
    private readonly users;
    private readonly botService;
    private readonly presenceService;
    private readonly catalog;
    private readonly stats;
    private readonly realtimeTracker;
    private readonly config;
    private readonly redisFactory;
    private realtimeNotifier?;
    private directoryNotifier?;
    private readonly logger;
    private redis;
    private readonly roomPayloadRedisPrefix;
    private readonly roomPayloadTtlSeconds;
    private readonly roomBans;
    private static isAdminRoles;
    setRealtimeNotifier(fn: (roomId: number) => Promise<void> | void): void;
    setRoomDeletedNotifier(fn: (roomId: number) => Promise<void> | void): void;
    setDirectoryNotifier(fn: (roomId: number, reason: string) => Promise<void> | void): void;
    notifyRoomStateUpdated(roomId: number): Promise<void>;
    adminDestroyRoom(roomId: number): Promise<{
        ok: true;
        roomId: number;
    }>;
    isBanned(roomId: number, userId: number): boolean;
    ban(roomId: number, userId: number): void;
    unban(roomId: number, userId: number): void;
    setOwner(roomId: number, userId: number, newOwnerId: number): Promise<Room>;
    requireRoomForOwnerAction(roomId: number, userId: number): Promise<Room>;
    saveRoom(room: Room): Promise<Room>;
    adminListRooms(opts?: {
        limit?: number;
        includePrivate?: boolean;
        includeStarted?: boolean;
        joinableOnly?: boolean;
    }): Promise<{
        items: Array<{
            id: number;
            name: string;
            gameType: string;
            status: string;
            isPrivate: boolean;
            maxPlayers: number;
            playersCount: number;
            botsCount: number;
            ownerUsername: string | null;
            activePlayers: number;
        }>;
    }>;
    adminCleanupRooms(opts?: {
        includePrivate?: boolean;
        includeStarted?: boolean;
        olderThanMinutes?: number;
        limit?: number;
        dryRun?: boolean;
        excludeActivePlayers?: boolean;
    }): Promise<{
        matched: number;
        deleted: number;
        roomIds: number[];
    }>;
    private notifyDirectoryChanged;
    constructor(rooms: Repository<Room>, participants: Repository<RoomParticipant>, vaultSnapshots: Repository<VaultRoomSnapshotEntity>, users: Repository<User>, botService: BotService, presenceService: PresenceService, catalog: CatalogService, stats: GameStatsService, realtimeTracker: RoomRealtimeTrackerService, config: ConfigService, redisFactory: RedisClientFactory);
    primeRoomPayloadCache(roomId: number, payload: RoomPayload): Promise<void>;
    invalidateRoomPayloadCache(roomId: number): Promise<void>;
    updateRoomPayloadCache(roomId: number, updater: (payload: RoomPayload) => RoomPayload | null): Promise<RoomPayload | null>;
    createRoom(userId: number, gameType: string, name?: string | null, maxPlayers?: number | null, isPrivate?: boolean, invalidateCache?: boolean): Promise<Room>;
    joinRoom(roomId: number, userId: number, opts?: {
        allowPrivate?: boolean;
    }): Promise<Room>;
    leaveRoom(roomId: number, userId: number, opts?: {
        preserveRoom?: boolean;
        disconnectOnly?: boolean;
        preserveOwner?: boolean;
    }): Promise<Room | null>;
    private ensureRoomDeletedNotifiers;
    transferOwnerIfCurrent(roomId: number, userId: number): Promise<void>;
    togglePrivacy(roomId: number, userId: number, invalidateCache?: boolean): Promise<Room>;
    startRoom(roomId: number, userId: number, invalidateCache?: boolean): Promise<Room>;
    resetRoom(roomId: number, userId: number, invalidateCache?: boolean): Promise<Room>;
    resetRoomSystem(roomId: number): Promise<Room>;
    getRoomPayload(roomId: number): Promise<RoomPayload>;
    private toPayload;
    private requireRoom;
    private requireUser;
    private ensureOwner;
    private isRoomOpen;
    private countActiveHumans;
    private countBots;
    leaveAllRoomsForUser(userId: number, opts?: {
        exceptRoomId?: number;
    }): Promise<void>;
    findLatestActiveRoomForUser(userId: number): Promise<{
        roomId: number;
        gameType: string;
    } | null>;
    private roomPayloadKey;
    private ensureRedisInitialized;
    private getCachedRoomPayload;
    private persistRoomPayload;
}
