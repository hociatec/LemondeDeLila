import { AuthoringError, authoringValueAt } from '../contracts/authoring-error';
import { authoringPathOf } from '../contracts/authoring-origin';
import type { JsonGamePattern } from './json-game-patterns';

/** Names renamed when a pattern constructs its component definitions. */
const aliases: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  'movement.track': { id: 'trackId' },
  'dice.set': { id: 'diceId', count: 'diceCount', sides: 'diceSides' },
  'pawn.set': { id: 'pawnSetId' },
  'inventory.set': { id: 'inventoryId' },
  'economy.market': { id: 'marketId', inventory: 'inventoryId' },
};

function patternComponents(
  pattern: unknown,
): readonly (readonly [string, unknown])[] {
  const value = (key: string) => authoringValueAt(pattern, key);
  switch (value('kind')) {
    case 'race':
      return [
        ['movement.track', value('trackId')],
        ['dice.set', value('diceId') ?? 'main'],
      ];
    case 'pawn-race':
      return [
        ['dice.set', value('diceId') ?? 'main'],
        ['pawn.set', value('pawnSetId')],
      ];
    case 'market':
      return [
        ['inventory.set', value('inventoryId')],
        ['economy.market', value('marketId')],
      ];
    default:
      return [];
  }
}

export function jsonPatternCompositionPath(
  document: unknown,
  origin: string,
): string | undefined {
  const match = /^patterns\[(\d+)\]\.(.+)$/.exec(origin);
  if (!match) return undefined;
  const root = `patterns[${match[1]}]`;
  const pattern = authoringValueAt(document, root);
  if (!pattern) return undefined; // Extension patterns follow all JSON patterns.
  const kind = authoringValueAt(pattern, 'kind');
  const field = match[2];
  if (field === 'turn') return `${root}.kind`;
  if (field === 'id') {
    const key =
      kind === 'race'
        ? 'trackId'
        : kind === 'pawn-race'
          ? 'pawnSetId'
          : kind === 'market'
            ? 'marketId'
            : 'kind';
    return `${root}.${key}`;
  }
  const component = /^components\[(\d+)\]\.id$/.exec(field);
  if (component) {
    const entry = patternComponents(pattern)[Number(component[1])];
    return entry ? `${root}.${aliases[entry[0]].id}` : undefined;
  }
  if (kind === 'market') {
    if (field.startsWith('initialization.resources')) return `${root}.currency`;
    if (field.startsWith('initialization.counters'))
      return `${root}.turnsCounterId`;
  }
  return undefined;
}

export function jsonPatternComponentPath(
  patterns: unknown,
  component: { component: string; id: string },
  field: string,
): string | undefined {
  if (!Array.isArray(patterns)) return undefined;
  const matches = patterns.flatMap((pattern: unknown, index) =>
    patternComponents(pattern).some(
      ([kind, id]) => kind === component.component && id === component.id,
    )
      ? [index]
      : [],
  );
  if (matches.length !== 1) return undefined;
  const split = /^([^.[\]]+)(.*)$/.exec(field);
  const mapped = split
    ? (aliases[component.component]?.[split[1]] ?? split[1]) + split[2]
    : field;
  return `patterns[${matches[0]}]${mapped ? `.${mapped}` : ''}`;
}

export function compileWithPatternDiagnostic<T>(
  pattern: JsonGamePattern,
  index: number,
  compile: () => T,
): T {
  try {
    return compile();
  } catch (error) {
    let field = authoringPathOf(error);
    if (field === undefined || !(error instanceof Error)) throw error;
    // These constructor fields belong only to dice in the JSON pattern grammar.
    if (pattern.kind === 'race' || pattern.kind === 'pawn-race')
      field = aliases['dice.set'][field] ?? field;
    throw new AuthoringError(
      `game.json.patterns[${index}].${field}`,
      error.message,
      authoringValueAt(pattern, field),
    );
  }
}
