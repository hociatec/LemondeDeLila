import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { basename, join } from 'node:path';
import {
  isGameDefinition,
  type DeclarativeGameDefinition,
  type GameActionMap,
} from '../core/application/runtime/game-definition';

type ModuleExports = Record<string, unknown>;
const loadModule = createRequire(__filename);

export type DiscoveredGameDefinition = DeclarativeGameDefinition<
  object,
  GameActionMap<object>,
  object
>;

/**
 * Discovers the one official game entry point: `games/<game>/game.ts`.
 * The same code works from the compiled tree where the entry point is `game.js`.
 */
export function discoverGameDefinitions(
  gamesRoot = join(__dirname, '..', 'games'),
  entryName = __filename.endsWith('.js') ? 'game.js' : 'game.ts',
): DiscoveredGameDefinition[] {
  const definitions = new Map<string, DiscoveredGameDefinition>();
  for (const file of walk(gamesRoot).filter(isEntry).sort()) {
    const exports = loadModule(file) as ModuleExports;
    for (const value of Object.values(exports)) {
      if (!isGameDefinition(value)) continue;
      const previous = definitions.get(value.id);
      if (previous && previous !== value) {
        throw new Error(`Définition de jeu dupliquée: ${value.id}`);
      }
      definitions.set(value.id, value);
    }
  }
  return [...definitions.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );

  function isEntry(file: string): boolean {
    return basename(file) === entryName;
  }
}

function walk(root: string): string[] {
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}
