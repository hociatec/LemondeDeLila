import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { GameDefinition, GameRulesAdapter } from '../interfaces/game-rules-adapter.interface';
import { PanierExpressService } from '../../games/jeux-de-plateaux/les-quatre-vents/panier-express/services/panier-express.service';

@Injectable()
export class GameRegistryService {
  private readonly handlers: GameRulesAdapter[];
  private readonly gamesRoot: string;
  private readonly logger = new Logger(GameRegistryService.name);
  private cachedDefinitions: GameDefinition[] | null = null;

  constructor(private readonly panierExpress: PanierExpressService) {
    this.handlers = [panierExpress];
    this.gamesRoot =
      process.env.GAME_CATALOG_PATH ??
      path.resolve(process.cwd(), 'src', 'game', 'games');
  }

  getHandler(gameType: string): GameRulesAdapter | undefined {
    return this.handlers.find((handler) => handler.gameType === gameType);
  }

  async listGames(): Promise<GameDefinition[]> {
    if (this.cachedDefinitions) {
      return this.cachedDefinitions;
    }
    const definitions = await this.loadDefinitionsFromFs();
    const merged = definitions.map((def) => this.enrichWithHandler(def));
    this.cachedDefinitions = merged;
    return merged;
  }

  private enrichWithHandler(def: GameDefinition): GameDefinition {
    const handler = this.getHandler(def.id);
    if (!handler) {
      return def;
    }
    return {
      id: def.id,
      name: def.name || handler.displayName,
      category: def.category || handler.category,
      subcategory: def.subcategory || handler.subcategory,
      description: def.description || handler.description,
      minPlayers: def.minPlayers ?? handler.minPlayers,
      maxPlayers: def.maxPlayers ?? handler.maxPlayers,
      manifestPath: def.manifestPath,
      rulesPath: def.rulesPath,
    };
  }

  private async loadDefinitionsFromFs(): Promise<GameDefinition[]> {
    const root = path.resolve(this.gamesRoot);
    if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
      this.logger.warn(`Répertoire de jeux introuvable : ${root}`);
      return [];
    }

    const manifests = await this.findManifestPaths(root);
    const results: GameDefinition[] = [];
    for (const manifestPath of manifests) {
      const def = await this.readDefinition(manifestPath, root);
      if (def) {
        results.push(def);
      }
    }
    return results;
  }

  private async findManifestPaths(root: string): Promise<string[]> {
    const stack: string[] = [root];
    const manifests: string[] = [];
    while (stack.length > 0) {
      const current = stack.pop() as string;
      const entries = await fs.promises.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
        } else if (entry.isFile() && entry.name === 'manifest.json') {
          manifests.push(fullPath);
        }
      }
    }
    return manifests;
  }

  private async readDefinition(manifestPath: string, root: string): Promise<GameDefinition | null> {
    try {
      const raw = await fs.promises.readFile(manifestPath, 'utf-8');
      const data = JSON.parse(raw) as Record<string, any>;
      const relPath = path.relative(root, path.dirname(manifestPath));
      const segments = relPath.split(path.sep).filter(Boolean);
      const category = this.formatName(segments[0] ?? data.category ?? 'Catalogue');
      const subcategory = this.formatName(segments[1] ?? data.subcategory ?? '');
      const id = data.code ?? data.id ?? '';
      if (!id) {
        this.logger.warn(`Manifest sans code ignoré: ${manifestPath}`);
        return null;
      }
      return {
        id,
        name: data.name ?? this.formatName(segments[segments.length - 1] ?? id),
        category,
        subcategory: subcategory || undefined,
        description: data.summary ?? data.description ?? '',
        minPlayers: data.minPlayers,
        maxPlayers: data.maxPlayers,
        manifestPath,
        rulesPath: path.join(path.dirname(manifestPath), 'rules.md'),
      };
    } catch (error) {
      this.logger.warn(`Manifest invalide ${manifestPath}: ${error}`);
      return null;
    }
  }

  private formatName(value: string): string {
    if (!value) return '';
    const spaced = value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ');
    return spaced
      .split(' ')
      .filter(Boolean)
      .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1).toLowerCase())
      .join(' ');
  }
}
