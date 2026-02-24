import { Repository } from 'typeorm';
import { RoomBot } from '../../room/entities/room-bot.entity';
import { Room } from '../../room/entities/room.entity';
import { RoomParticipant } from '../../room/entities/room-participant.entity';
import { BotName } from '../entities/bot-name.entity';
export declare class BotService {
    private readonly bots;
    private readonly rooms;
    private readonly participants;
    private readonly botNames;
    private cachedEnabledNames;
    private readonly namesCacheTtlMs;
    constructor(bots: Repository<RoomBot>, rooms: Repository<Room>, participants: Repository<RoomParticipant>, botNames: Repository<BotName>);
    addBot(roomId: number, userId: number): Promise<RoomBot>;
    addBotSystem(roomId: number): Promise<RoomBot>;
    removeBot(roomId: number, userId: number, botId: number): Promise<RoomBot>;
    getLastBotForRoom(roomId: number): Promise<RoomBot | null>;
    statsForRoom(roomId: number): Promise<{
        roomId: number;
        total: number;
    }>;
    listBotNames(): Promise<BotName[]>;
    createBotName(name: string, enabled?: boolean): Promise<BotName>;
    updateBotName(id: number, update: {
        name?: string | null;
        enabled?: boolean | null;
    }): Promise<BotName>;
    deleteBotName(id: number): Promise<BotName>;
    private pickName;
    private sanitizeName;
    private findAvailableName;
    private getEnabledNames;
    private invalidateBotNamesCache;
    private seedDefaultNames;
    private shuffle;
    private countBots;
    countBotsForRoom(roomId: number): Promise<number>;
    removeAllBotsForRoom(roomId: number): Promise<void>;
    private countActiveHumans;
    private requireRoomWithOwner;
    private ensureOwner;
    private isRoomOpen;
}
