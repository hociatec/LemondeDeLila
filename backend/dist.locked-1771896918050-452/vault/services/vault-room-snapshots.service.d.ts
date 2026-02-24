import { Repository } from 'typeorm';
import { VaultRoomSnapshotEntity } from '../entities/vault-room-snapshot.entity';
import { RoomService } from '../../room/services/room.service';
import { BotService } from '../../bot/services/bot.service';
import { RoomBot } from '../../room/entities/room-bot.entity';
import { GameEngineService } from '../../game/engine/services/game-engine.service';
import { GameRegistryService } from '../../game/engine/services/game-registry.service';
import { NotificationService } from '../../notification/services/notification.service';
import { PresenceService } from '../../presence/services/presence.service';
export declare class VaultRoomSnapshotsService {
    private readonly snapshots;
    private readonly roomBots;
    private readonly rooms;
    private readonly bots;
    private readonly engine;
    private readonly registry;
    private readonly notifications;
    private readonly presence;
    constructor(snapshots: Repository<VaultRoomSnapshotEntity>, roomBots: Repository<RoomBot>, rooms: RoomService, bots: BotService, engine: GameEngineService, registry: GameRegistryService, notifications: NotificationService, presence: PresenceService);
    list(ownerUserId: number): Promise<Array<{
        id: string;
        name: string;
        roomName: string;
        gameType: string;
        playersLabel: string;
        createdAt: string;
    }>>;
    delete(ownerUserId: number, snapshotId: string): Promise<boolean>;
    save(ownerUserId: number, roomId: number, snapshotId?: string | null): Promise<{
        id: string;
    }>;
    restore(ownerUserId: number, snapshotId: string): Promise<{
        roomId: number;
    }>;
    abandonRestoredRoom(ownerUserId: number, roomId: number): Promise<boolean>;
    private parseSnapshot;
    private remapState;
    private uniqueUsers;
}
