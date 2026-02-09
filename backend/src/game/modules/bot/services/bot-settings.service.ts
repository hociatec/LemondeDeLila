import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BotSettingsEntity } from '../entities/bot-settings.entity';

export type BotSettings = {
  botTurnDelayMs: number;
  botStartDelayMs: number;
  botDrawDelayMs: number;
};

type BotSettingsRoot = {
  botTurnDelayMs: number;
  botStartDelayMs: number;
  botDrawDelayMs: number;
};

@Injectable()
export class BotSettingsService implements OnModuleInit {
  private readonly logger = new Logger(BotSettingsService.name);
  private cache: BotSettingsRoot | null = null;

  private static readonly DEFAULT_TURN_DELAY_MS = 4000;
  private static readonly DEFAULT_START_DELAY_MS = 4000;
  private static readonly DEFAULT_DRAW_DELAY_MS = 4000;
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
    return {
      botTurnDelayMs: root.botTurnDelayMs,
      botStartDelayMs: root.botStartDelayMs,
      botDrawDelayMs: root.botDrawDelayMs,
    };
  }

  getBotTurnDelayMs(): number {
    return this.getRoot().botTurnDelayMs;
  }

  getBotStartDelayMs(): number {
    return this.getRoot().botStartDelayMs;
  }

  getBotDrawDelayMs(): number {
    return this.getRoot().botDrawDelayMs;
  }

  async updateSettings(update: {
    botTurnDelayMs?: number;
    botStartDelayMs?: number;
    botDrawDelayMs?: number;
  }): Promise<BotSettings> {
    await this.ensureSeeded();
    const root = this.getRoot();

    if (update.botTurnDelayMs !== undefined) {
      root.botTurnDelayMs = this.clampDelay(update.botTurnDelayMs);
    }
    if (update.botStartDelayMs !== undefined) {
      root.botStartDelayMs = this.clampDelay(update.botStartDelayMs);
    }
    if (update.botDrawDelayMs !== undefined) {
      root.botDrawDelayMs = this.clampDelay(update.botDrawDelayMs);
    }

    await this.repo.save({
      id: 1,
      botTurnDelayMs: root.botTurnDelayMs,
      botStartDelayMs: root.botStartDelayMs,
      botDrawDelayMs: root.botDrawDelayMs,
    });
    if (!this.cache) {
      this.cache = { botTurnDelayMs: root.botTurnDelayMs, botStartDelayMs: root.botStartDelayMs, botDrawDelayMs: root.botDrawDelayMs };
    } else {
      this.cache = {
        botTurnDelayMs: root.botTurnDelayMs,
        botStartDelayMs: root.botStartDelayMs,
        botDrawDelayMs: root.botDrawDelayMs,
      };
    }
    return {
      botTurnDelayMs: root.botTurnDelayMs,
      botStartDelayMs: root.botStartDelayMs,
      botDrawDelayMs: root.botDrawDelayMs,
    };
  }

  private clampDelay(value: number): number {
    const candidate = Number(value);
    if (!Number.isFinite(candidate)) {
      return BotSettingsService.DEFAULT_TURN_DELAY_MS;
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
    return {
      botTurnDelayMs: BotSettingsService.DEFAULT_TURN_DELAY_MS,
      botStartDelayMs: BotSettingsService.DEFAULT_START_DELAY_MS,
      botDrawDelayMs: BotSettingsService.DEFAULT_DRAW_DELAY_MS,
    };
  }

  private async ensureSeeded(): Promise<void> {
    if (this.cache) return;

    try {
      const existing = await this.repo.findOne({ where: { id: 1 } });
      if (existing) {
        this.cache = {
          botTurnDelayMs: this.clampDelay(existing.botTurnDelayMs),
          botStartDelayMs: this.clampDelay(existing.botStartDelayMs),
          botDrawDelayMs: this.clampDelay(existing.botDrawDelayMs),
        };
        return;
      }

      const delay = BotSettingsService.DEFAULT_TURN_DELAY_MS;
      const startDelay = BotSettingsService.DEFAULT_START_DELAY_MS;
      const drawDelay = BotSettingsService.DEFAULT_DRAW_DELAY_MS;
      await this.repo.insert({
        id: 1,
        botTurnDelayMs: delay,
        botStartDelayMs: startDelay,
        botDrawDelayMs: drawDelay,
      });
      this.cache = {
        botTurnDelayMs: delay,
        botStartDelayMs: startDelay,
        botDrawDelayMs: drawDelay,
      };
    } catch (error) {
      this.logger.warn(
        `Impossible de charger/initialiser bot_settings: ${(error as Error).message}`,
      );
      this.cache = {
        botTurnDelayMs: BotSettingsService.DEFAULT_TURN_DELAY_MS,
        botStartDelayMs: BotSettingsService.DEFAULT_START_DELAY_MS,
        botDrawDelayMs: BotSettingsService.DEFAULT_DRAW_DELAY_MS,
      };
    }
  }
}
