import * as fs from 'fs';
import * as path from 'path';
import { Injectable, Logger } from '@nestjs/common';

export type BotSettings = {
  botTurnDelayMs: number;
};

type BotSettingsFile = {
  botTurnDelayMs: number;
};

@Injectable()
export class BotSettingsService {
  private readonly logger = new Logger(BotSettingsService.name);
  private readonly filePath: string;
  private cache: BotSettingsFile | null = null;

  private static readonly DEFAULT_DELAY_MS = 4000;
  private static readonly MIN_DELAY_MS = 0;
  private static readonly MAX_DELAY_MS = 60000;

  constructor() {
    const cwd = process.cwd();
    this.filePath = path.resolve(cwd, 'data', 'bot-settings.json');
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
    const root = this.getRoot();

    if (update.botTurnDelayMs !== undefined) {
      root.botTurnDelayMs = this.clampDelay(update.botTurnDelayMs);
    }

    await this.save(root);
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
    const loaded = this.tryLoad();
    this.cache = loaded;
    return loaded;
  }

  private tryLoad(): BotSettingsFile {
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

  private async save(root: BotSettingsFile): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(
      this.filePath,
      JSON.stringify(root, null, 2),
      'utf-8',
    );
  }
}

