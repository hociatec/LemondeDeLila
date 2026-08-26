import {
  isGameDefinition,
  type DeclarativeGameDefinition,
  type GameActionMap,
} from '../core/application/runtime/game-definition';
import { GENERATED_GAME_DEFINITIONS } from './generated-game-registry';

export type DiscoveredGameDefinition = DeclarativeGameDefinition<
  object,
  GameActionMap<object>,
  object
>;

/**
 * Reads the build-generated registry. Adding a game never requires editing a
 * central source file, while bundlers and TypeScript still see static imports.
 */
export function discoverGameDefinitions(): DiscoveredGameDefinition[] {
  const definitions = new Map<string, DiscoveredGameDefinition>();
  for (const value of GENERATED_GAME_DEFINITIONS) {
    if (!isGameDefinition(value)) {
      throw new Error('Entrée de registry invalide: defineGame() est requis');
    }
    const previous = definitions.get(value.id);
    if (previous && previous !== value) {
      throw new Error(`Définition de jeu dupliquée: ${value.id}`);
    }
    definitions.set(value.id, value);
  }
  return [...definitions.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}
