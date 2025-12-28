import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import type { GameDefinition } from '../interfaces/game-rules-adapter.interface';

export type GameCatalogOverride = {
  enabled?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  name?: string;
  description?: string;
};

type OverridesFile = {
  games: Record<string, GameCatalogOverride>;
};

@Injectable()
export class GameCatalogOverridesService {
  private readonly logger = new Logger(GameCatalogOverridesService.name);
  private readonly filePath: string;
  private cache: OverridesFile | null = null;

  constructor() {
    const cwd = process.cwd();
    this.filePath = path.resolve(cwd, 'data', 'game-overrides.json');
  }

  getOverrides(): OverridesFile {
    if (this.cache) return this.cache;
    const loaded = this.tryLoad();
    this.cache = loaded;
    return loaded;
  }

  getGameOverride(gameType: string): GameCatalogOverride | null {
    if (!gameType) return null;
    const root = this.getOverrides();
    return root.games[gameType] ?? null;
  }

  apply(def: GameDefinition): GameDefinition & { enabled?: boolean } {
    const ov = this.getGameOverride(def.id);
    if (!ov) return { ...def, enabled: true };
    return {
      ...(def as any),
      enabled: ov.enabled !== false,
      name: ov.name ?? def.name,
      description: ov.description ?? def.description,
      minPlayers: typeof ov.minPlayers === 'number' ? ov.minPlayers : def.minPlayers,
      maxPlayers: typeof ov.maxPlayers === 'number' ? ov.maxPlayers : def.maxPlayers,
    };
  }

  async setEnabled(gameType: string, enabled: boolean): Promise<void> {
    if (!gameType || !gameType.trim()) {
      throw new Error('gameType requis');
    }
    const root = this.getOverrides();
    root.games[gameType] = { ...(root.games[gameType] ?? {}), enabled };
    await this.save(root);
    this.cache = root;
  }

  async updateGameOverride(
    gameType: string,
    update: GameCatalogOverride,
  ): Promise<GameCatalogOverride> {
    if (!gameType || !gameType.trim()) {
      throw new Error('gameType requis');
    }
    const root = this.getOverrides();
    const next: GameCatalogOverride = {
      ...(root.games[gameType] ?? {}),
      ...update,
    };
    // Nettoyage: chaînes vides => suppression du champ
    if (typeof next.name === 'string' && !next.name.trim()) delete next.name;
    if (typeof next.description === 'string' && !next.description.trim())
      delete next.description;
    root.games[gameType] = next;
    await this.save(root);
    this.cache = root;
    return next;
  }

  async clearGameOverride(gameType: string): Promise<void> {
    if (!gameType || !gameType.trim()) {
      throw new Error('gameType requis');
    }
    const root = this.getOverrides();
    delete root.games[gameType];
    await this.save(root);
    this.cache = root;
  }

  private tryLoad(): OverridesFile {
    try {
      if (!fs.existsSync(this.filePath)) {
        return { games: {} };
      }
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw.replace(/^\uFEFF/, '')) as OverridesFile;
      if (!parsed || typeof parsed !== 'object') return { games: {} };
      if (!parsed.games || typeof parsed.games !== 'object') return { games: {} };
      return { games: parsed.games };
    } catch (err) {
      this.logger.warn(
        `Impossible de charger les overrides catalogue (${this.filePath}): ${
          (err as Error).message
        }`,
      );
      return { games: {} };
    }
  }

  private async save(root: OverridesFile): Promise<void> {
    const dir = path.dirname(this.filePath);
    await fs.promises.mkdir(dir, { recursive: true });
    await fs.promises.writeFile(
      this.filePath,
      JSON.stringify(root, null, 2),
      'utf-8',
    );
  }
}
