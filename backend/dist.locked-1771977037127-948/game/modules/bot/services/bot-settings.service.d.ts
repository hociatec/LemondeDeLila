import { OnModuleInit } from '@nestjs/common';
import { Repository } from 'typeorm';
import { BotSettingsEntity } from '../entities/bot-settings.entity';
export type BotSettings = {
    botTurnDelayMs: number;
    botStartDelayMs: number;
    botDrawDelayMs: number;
};
export declare class BotSettingsService implements OnModuleInit {
    private readonly repo;
    private readonly logger;
    private cache;
    private static readonly DEFAULT_TURN_DELAY_MS;
    private static readonly DEFAULT_START_DELAY_MS;
    private static readonly DEFAULT_DRAW_DELAY_MS;
    private static readonly MIN_DELAY_MS;
    private static readonly MAX_DELAY_MS;
    constructor(repo: Repository<BotSettingsEntity>);
    onModuleInit(): Promise<void>;
    getSettings(): BotSettings;
    getBotTurnDelayMs(): number;
    getBotStartDelayMs(): number;
    getBotDrawDelayMs(): number;
    updateSettings(update: {
        botTurnDelayMs?: number;
        botStartDelayMs?: number;
        botDrawDelayMs?: number;
    }): Promise<BotSettings>;
    private clampDelay;
    private getRoot;
    private ensureSeeded;
}
