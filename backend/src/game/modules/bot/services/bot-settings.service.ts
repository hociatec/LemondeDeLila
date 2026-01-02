import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BotSettingsEntity } from '../entities/bot-settings.entity';

export type BotSettings = {
  botTurnDelayMs: number;
};

type BotSettingsRoot = {
  botTurnDelayMs: number;
};

@Injectable()
export class BotSettingsService implements OnModuleInit {
  private readonly logger = new Logger(BotSettingsService.name);
  private cache: BotSettingsRoot | null = null;

  private static readonly DEFAULT_DELAY_MS = 4000;
  private static readonly MIN_DELAY_MS = 0;
  private static readonly MAX_DELAY_MS = 60000;

  constructor(
    @InjectRepository(BotSettingsEntity)
    private readonly repo: Repository<BotSettingsEntity>,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  getSettings(): BotSettings {
    const root = this.getRoot();
    return { botTurnDelayMs: root.botTurnDelayMs };
  }

  getBotTurnDelayMs(): number {
    return this.getRoot().botTurnDelayMs;
  }

  async updateSettings(update: { botTurnDelayMs?: number }): Promise<BotSettings> {
    await this.ensureSeeded();
    const root = this.getRoot();

    if (update.botTurnDelayMs !== undefined) {
      root.botTurnDelayMs = this.clampDelay(update.botTurnDelayMs);
    }

    await this.repo.save({ id: 1, botTurnDelayMs: root.botTurnDelayMs });
    this.cache = root;
    return { botTurnDelayMs: root.botTurnDelayMs };
  }

  private clampDelay(value: number): number {
    const candidate = Number(value);
    if (!Number.isFinite(candidate)) {
      return BotSettingsService.DEFAULT_DELAY_MS;
    }
    const rounded = Math.round(candidate);
    if (rounded < BotSettingsService.MIN_DELAY_MS) {
      return BotSettingsService.MIN_DELAY_MS;
    }
    if (rounded > BotSettingsService.MAX_DELAY_MS) {
      return BotSettingsService.MAX_DELAY_MS;
    }
    return rounded;
  }

  private getRoot(): BotSettingsRoot {
    if (this.cache) {
      return this.cache;
    }
    return { botTurnDelayMs: BotSettingsService.DEFAULT_DELAY_MS };
  }

  private async ensureSeeded(): Promise<void> {
    if (this.cache) return;

    try {
      const existing = await this.repo.findOne({ where: { id: 1 } });
      if (existing) {
        this.cache = { botTurnDelayMs: this.clampDelay(existing.botTurnDelayMs) };
        return;
      }

      const delay = BotSettingsService.DEFAULT_DELAY_MS;
      await this.repo.insert({ id: 1, botTurnDelayMs: delay });
      this.cache = { botTurnDelayMs: delay };
    } catch (error) {
      this.logger.warn(
        `Impossible de charger/initialiser bot_settings: ${(error as Error).message}`,
      );
      this.cache = { botTurnDelayMs: BotSettingsService.DEFAULT_DELAY_MS };
    }
  }
}

