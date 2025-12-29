import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BotSettingsEntity } from '../entities/bot-settings.entity';

export type BotSettings = {
  botTurnDelayMs: number;
};

type BotSettingsFile = {
  botTurnDelayMs: number;
};

@Injectable()
export class BotSettingsService implements OnModuleInit {
  private readonly logger = new Logger(BotSettingsService.name);
  private readonly filePath: string;
  private cache: BotSettingsFile | null = null;

  private static readonly DEFAULT_DELAY_MS = 4000;
  private static readonly MIN_DELAY_MS = 0;
  private static readonly MAX_DELAY_MS = 60000;

  constructor(
    @InjectRepository(BotSettingsEntity)
    private readonly repo: Repository<BotSettingsEntity>,
  ) {
    const cwd = process.cwd();
    this.filePath = path.resolve(cwd, 'data', 'bot-settings.json');
  }

  async onModuleInit(): Promise<void> {
    await this.ensureSeeded();
  }

  getSettings(): BotSettings {
    const root = this.getRoot();
    return { botTurnDelayMs: root.botTurnDelayMs };
  }

  getBotTurnDelayMs(): number {
    const root = this.getRoot();
    return root.botTurnDelayMs;
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

  private getRoot(): BotSettingsFile {
    if (this.cache) {
      return this.cache;
    }
    // Si onModuleInit n'est pas encore passé, on renvoie une valeur safe.
    return { botTurnDelayMs: BotSettingsService.DEFAULT_DELAY_MS };
  }

  private tryLoadFromJson(): BotSettingsFile {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { botTurnDelayMs: BotSettingsService.DEFAULT_DELAY_MS };
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as Partial<BotSettingsFile>;
      const delay =
        typeof parsed?.botTurnDelayMs === 'number'
          ? this.clampDelay(parsed.botTurnDelayMs)
          : BotSettingsService.DEFAULT_DELAY_MS;
      return { botTurnDelayMs: delay };
    } catch (error) {
      this.logger.warn(
        `Impossible de charger les paramètres bots (${this.filePath}): ${(error as Error).message}`,
      );
      return { botTurnDelayMs: BotSettingsService.DEFAULT_DELAY_MS };
    }
  }

  private async ensureSeeded(): Promise<void> {
    if (this.cache) return;
    const existing = await this.repo.findOne({ where: { id: 1 } });
    if (existing) {
      this.cache = {
        botTurnDelayMs: this.clampDelay(existing.botTurnDelayMs),
      };
      return;
    }

    const fromFile = this.tryLoadFromJson();
    const delay = this.clampDelay(fromFile.botTurnDelayMs);
    await this.repo.insert({ id: 1, botTurnDelayMs: delay });
    this.cache = { botTurnDelayMs: delay };
  }
}
