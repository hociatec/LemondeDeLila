import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import { GameRegistryService } from './game-registry.service';

@Injectable()
export class GameContentService {
  private readonly rulesCache = new Map<
    string,
    { value: string; loadedAt: number }
  >();
  private readonly devTtlMs = 3000;

  constructor(private readonly registry: GameRegistryService) {}

  async getRules(gameType: string): Promise<string> {
    const key = String(gameType ?? '').trim();
    if (key) {
      const cached = this.rulesCache.get(key) ?? null;
      if (cached) {
        const ttl =
          process.env.NODE_ENV === 'development'
            ? this.devTtlMs
            : Number.POSITIVE_INFINITY;
        if (Date.now() - cached.loadedAt < ttl) {
          return cached.value;
        }
      }
    }

    const defs = await this.registry.listGames();
    const game = defs.find((g) => g.id === gameType);
    if (game?.rulesPath && fs.existsSync(game.rulesPath)) {
      try {
        const value = await fs.promises.readFile(game.rulesPath, 'utf-8');
        if (key) {
          this.rulesCache.set(key, { value, loadedAt: Date.now() });
        }
        return value;
      } catch {
        /* ignore */
      }
    }

    const fallback = `Règles non disponibles pour ${gameType}.`;
    if (key) {
      this.rulesCache.set(key, { value: fallback, loadedAt: Date.now() });
    }
    return fallback;
  }
}
