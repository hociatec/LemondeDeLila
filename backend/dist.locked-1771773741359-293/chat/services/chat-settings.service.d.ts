import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ChatSettingsEntity } from '../entities/chat-settings.entity';
export type ChatSettings = {
    chatHistoryLimit: number;
    editWindowSeconds: number;
};
export declare class ChatSettingsService implements OnModuleInit {
    private readonly repo;
    private readonly logger;
    private cache;
    private static readonly DEFAULT_HISTORY_LIMIT;
    private static readonly MIN_HISTORY_LIMIT;
    private static readonly MAX_HISTORY_LIMIT;
    private static readonly DEFAULT_EDIT_WINDOW_SECONDS;
    private static readonly MIN_EDIT_WINDOW_SECONDS;
    private static readonly MAX_EDIT_WINDOW_SECONDS;
    constructor(repo: Repository<ChatSettingsEntity>);
    onModuleInit(): Promise<void>;
    getSettings(): ChatSettings;
    getChatHistoryLimit(): number;
    getEditWindowSeconds(): number;
    updateSettings(update: {
        chatHistoryLimit?: number;
        editWindowSeconds?: number;
    }): Promise<ChatSettings>;
    private clampHistoryLimit;
    private clampEditWindowSeconds;
    private ensureSeeded;
}
