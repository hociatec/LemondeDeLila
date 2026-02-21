import { DynamicModule, Logger, Module } from '@nestjs/common';
import { createRequire } from 'module';
import * as fs from 'fs';
import * as path from 'path';

type ModuleClass = new (...args: any[]) => any;

const requireModule = createRequire(__filename);

@Module({})
export class GamePluginsModule {
  private static readonly logger = new Logger(GamePluginsModule.name);

  static forRoot(): DynamicModule {
    const imports = this.discoverGameModules();
    if (imports.length === 0) {
      this.logger.warn('Aucun module de jeu détecté (dist/src).');
    } else {
      this.logger.log(
        `Modules de jeu détectés : ${imports.map((m) => m.name).join(', ')}`,
      );
    }
    return {
      module: GamePluginsModule,
      imports,
    };
  }

  private static discoverGameModules(): ModuleClass[] {
    const root = this.resolveGamesRoot();
    if (!root) {
      this.logger.warn(
        'Répertoire des jeux introuvable (dist/game/games ou src/game/games).',
      );
      return [];
    }
    const moduleFiles = this.findModuleFiles(root);
    const modules: ModuleClass[] = [];
    for (const file of moduleFiles) {
      const loaded = this.loadModuleClasses(file);
      modules.push(...loaded);
    }
    return modules;
  }

  private static resolveGamesRoot(): string | null {
    const envRoot = process.env.GAME_MODULES_ROOT;
    const candidates = [
      envRoot && path.resolve(envRoot),
      path.resolve(process.cwd(), 'dist', 'game', 'games'),
      path.resolve(process.cwd(), 'dist', 'src', 'game', 'games'),
      path.resolve(process.cwd(), 'src', 'game', 'games'),
    ].filter(Boolean) as string[];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
        return candidate;
      }
    }
    return null;
  }

  private static findModuleFiles(root: string): string[] {
    const stack: string[] = [root];
    const results: string[] = [];
    while (stack.length) {
      const current = stack.pop() as string;
      const entries = fs.readdirSync(current, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(fullPath);
          continue;
        }
        if (!entry.isFile()) continue;
        if (entry.name.endsWith('.d.ts')) continue;
        if (
          entry.name.endsWith('.module.js') ||
          entry.name.endsWith('.module.ts')
        ) {
          results.push(fullPath);
        }
      }
    }
    return results;
  }

  private static loadModuleClasses(filePath: string): ModuleClass[] {
    try {
      const moduleExports = requireModule(filePath) as Record<string, unknown>;
      const candidates = Object.values(moduleExports).filter(
        (value): value is ModuleClass =>
          typeof value === 'function' && value.name.endsWith('Module'),
      );
      if (!candidates.length) {
        this.logger.warn(`Aucun module exporté trouvé dans ${filePath}`);
      }
      return candidates;
    } catch (error: unknown) {
      const errorMessage =
        typeof error === 'string'
          ? error
          : error instanceof Error
            ? error.message
            : 'Erreur inconnue';
      this.logger.warn(`Impossible de charger ${filePath} : ${errorMessage}`);
      return [];
    }
  }
}
