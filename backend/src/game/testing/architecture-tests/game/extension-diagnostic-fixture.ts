import { discoverGameDefinitions } from '../../../composition/game-module-discovery';

export type Data = Record<string, unknown>;
export function object(value: unknown): Data {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected object');
  return value as Data;
}

const definitions = discoverGameDefinitions();
const patternKinds: Record<string, string> = {
  chapterEncounter: 'chapter-encounter',
  pawScoring: 'paw-scoring',
  ritualPhases: 'ritual-phases',
  themeNameCards: 'theme-name',
};

export function fixture(key: string) {
  const kind = patternKinds[key];
  if (!kind) throw new Error('Unknown fixture: ' + key);
  const definition = definitions.find(
    (entry) =>
      Array.isArray(object(entry.content?.data).patterns) &&
      (object(entry.content?.data).patterns as unknown[]).some(
        (pattern) => object(pattern).kind === kind,
      ),
  );
  if (!definition) throw new Error('Missing fixture: ' + key);
  const source = structuredClone(object(definition.content?.data));
  const patterns = source.patterns as unknown[];
  const patternIndex = patterns.findIndex(
    (pattern) => object(pattern).kind === kind,
  );
  const program = object(object(patterns[patternIndex]).config);
  return {
    source,
    program,
    root: `patterns[${patternIndex}].config`,
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
