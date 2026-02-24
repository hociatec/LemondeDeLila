import { Repository } from 'typeorm';
import { ChatMessage } from '../entities/chat-message.entity';
import { ChatValidator } from './chat.validator';
import { ChatSettingsService } from './chat-settings.service';
type BroadcastUser = {
    id: number;
    username: string;
};
export declare class ChatService {
    private readonly messages;
    private readonly validator;
    private readonly settings;
    private static readonly DEFAULT_HISTORY_LIMIT;
    private static readonly CACHE_LIMIT;
    private historyCache;
    constructor(messages: Repository<ChatMessage>, validator: ChatValidator, settings: ChatSettingsService);
    recordMessageForBroadcast(user: BroadcastUser, text: string): Promise<Record<string, unknown>>;
    editOwnMessage(userId: number, messageId: string, text: string): Promise<Record<string, unknown>>;
    deleteOwnMessage(userId: number, messageId: string): Promise<boolean>;
    getRecentMessages(limit?: number, since?: Date): Promise<ChatMessage[]>;
    getRecentNormalizedMessages(limit?: number): Promise<Array<Record<string, unknown>>>;
    normalize(message: ChatMessage): Record<string, unknown>;
    normalizeMany(messages: ChatMessage[]): Array<Record<string, unknown>>;
    adminListMessages(limit?: number, includeDeleted?: boolean): Promise<ChatMessage[]>;
    adminDeleteMessage(messageId: string): Promise<boolean>;
    adminClearAll(): Promise<number>;
    private generateMessageId;
    private ensureHistoryCache;
    private appendToCache;
    private removeFromCache;
    private replaceInCache;
    private getCachedId;
}
export {};
