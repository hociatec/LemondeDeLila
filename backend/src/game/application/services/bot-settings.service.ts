import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  BOT_SETTINGS_REPOSITORY,
  type BotSettingsRepository,
} from '../contracts/bot-settings.repository';

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
  private static sharedCache: BotSettingsRoot | null = null;

  private static readonly DEFAULT_TURN_DELAY_MS = 600;
  private static readonly DEFAULT_START_DELAY_MS = 250;
  private static readonly DEFAULT_DRAW_DELAY_MS = 250;
  private static readonly MIN_DELAY_MS = 0;
  private static readonly MAX_DELAY_MS = 60000;

  constructor(
    @Inject(BOT_SETTINGS_REPOSITORY)
    private readonly repo: BotSettingsRepository,
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

    await this.repo.saveSettings({
      botTurnDelayMs: root.botTurnDelayMs,
      botStartDelayMs: root.botStartDelayMs,
      botDrawDelayMs: root.botDrawDelayMs,
    });
    BotSettingsService.sharedCache = {
      botTurnDelayMs: root.botTurnDelayMs,
      botStartDelayMs: root.botStartDelayMs,
      botDrawDelayMs: root.botDrawDelayMs,
    };
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
    if (BotSettingsService.sharedCache) {
      return BotSettingsService.sharedCache;
    }
    return {
      botTurnDelayMs: BotSettingsService.DEFAULT_TURN_DELAY_MS,
      botStartDelayMs: BotSettingsService.DEFAULT_START_DELAY_MS,
      botDrawDelayMs: BotSettingsService.DEFAULT_DRAW_DELAY_MS,
    };
  }

  private async ensureSeeded(): Promise<void> {
    if (BotSettingsService.sharedCache) return;

    try {
      const existing = await this.repo.findSettings();
      if (existing) {
        BotSettingsService.sharedCache = {
          botTurnDelayMs: this.clampDelay(existing.botTurnDelayMs),
          botStartDelayMs: this.clampDelay(existing.botStartDelayMs),
          botDrawDelayMs: this.clampDelay(existing.botDrawDelayMs),
        };
        return;
      }

      const delay = BotSettingsService.DEFAULT_TURN_DELAY_MS;
      const startDelay = BotSettingsService.DEFAULT_START_DELAY_MS;
      const drawDelay = BotSettingsService.DEFAULT_DRAW_DELAY_MS;
      await this.repo.saveSettings({
        botTurnDelayMs: delay,
        botStartDelayMs: startDelay,
        botDrawDelayMs: drawDelay,
      });
      BotSettingsService.sharedCache = {
        botTurnDelayMs: delay,
        botStartDelayMs: startDelay,
        botDrawDelayMs: drawDelay,
      };
    } catch (error) {
      this.logger.warn(
        `Impossible de charger/initialiser bot_settings: ${(error as Error).message}`,
      );
      BotSettingsService.sharedCache = {
        botTurnDelayMs: BotSettingsService.DEFAULT_TURN_DELAY_MS,
        botStartDelayMs: BotSettingsService.DEFAULT_START_DELAY_MS,
        botDrawDelayMs: BotSettingsService.DEFAULT_DRAW_DELAY_MS,
      };
    }
  }
}
