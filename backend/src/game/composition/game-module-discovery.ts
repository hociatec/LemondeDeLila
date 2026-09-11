import {
  isGameDefinition,
  type CompiledGameDefinition,
  type GameActionMap,
} from '../engine/runtime/definitions/game-definition';
import { GENERATED_GAME_PACKAGES } from './generated-game-registry';
import { assertGameManifestMatches } from '../core/application/helpers/game-manifest-validation';

export type DiscoveredGameDefinition = CompiledGameDefinition<
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
  for (const { definition: value, manifest } of GENERATED_GAME_PACKAGES) {
    if (!isGameDefinition(value)) {
      throw new Error('Entrée de registry invalide: defineGame() est requis');
    }
    assertGameManifestMatches(manifest, {
      code: value.id,
      name: value.displayName,
      minPlayers: value.players.min,
      maxPlayers: value.players.max,
      summary: value.description,
    });
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
