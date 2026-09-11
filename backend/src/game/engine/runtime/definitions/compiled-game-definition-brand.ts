import { GameConfigurationError } from '../../../core/domain/errors/game-domain.errors';

const compiledDefinitions = new WeakSet<object>();

export function markCompiledGameDefinition(definition: object): void {
  compiledDefinitions.add(definition);
}

export function assertCompiledGameDefinition(definition: object): void {
  if (!compiledDefinitions.has(definition)) {
    throw new GameConfigurationError(
      'Le runtime requiert un artefact produit par defineGame',
    );
  }
}
