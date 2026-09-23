import { discoverGameDefinitions } from '../../../composition/game-module-discovery';

export type Data = Record<string, unknown>;
export function object(value: unknown): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected object');
  return value as Data;
}

const definitions = discoverGameDefinitions();
export function fixture(key: string) {
  const definition = definitions.find(
    (entry) => object(entry.content?.data)[key],
  );
  if (!definition) throw new Error('Missing fixture: ' + key);
  const source = structuredClone(object(definition.content?.data));
  const program = object(source[key]);
  delete source[key];
  source.extensions = [{ type: key, config: program }];
  return {
    source,
    program,
    manifest: {
      code: definition.id,
      engine: definition.id,
      name: definition.displayName,
      summary: definition.description ?? '',
      minPlayers: definition.players.min,
      maxPlayers: definition.players.max,
    },
  };
}
