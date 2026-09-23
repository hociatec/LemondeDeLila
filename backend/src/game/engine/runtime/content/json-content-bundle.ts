import { assertAuthorJson } from '../contracts/json-author-schema';
import { AuthoringError } from '../contracts/authoring-error';

export type JsonContentAssets = Readonly<Record<string, unknown>>;

const MAX_ASSETS = 256;
const MAX_EXPANDED_NODES = 100_000;
const MAX_DEPTH = 64;

/** Pure assembly: references address supplied data, never files or URLs. */
export function resolveJsonContent(
  source: unknown,
  assets: JsonContentAssets = {},
): unknown {
  assertAuthorJson({ source, assets });
  if (Object.keys(assets).length > MAX_ASSETS)
    throw new AuthoringError(
      'assets',
      `at most ${MAX_ASSETS} assets`,
      Object.keys(assets).length,
      'Too many JSON content assets',
    );
  for (const key of Object.keys(assets))
    parseContentReference(key, `assets[${JSON.stringify(key)}]`, false);
  let nodes = 0;
  const active = new Set<string>();
  const visit = (value: unknown, depth: number, location: string): unknown => {
    if (++nodes > MAX_EXPANDED_NODES || depth > MAX_DEPTH)
      throw new AuthoringError(
        location,
        'bounded expanded JSON content',
        value,
        'Expanded JSON content exceeds its bounds',
      );
    if (Array.isArray(value))
      return value.map((entry, index) =>
        visit(entry, depth + 1, `${location}[${index}]`),
      );
    if (value === null || typeof value !== 'object') return value;
    const entries = Object.entries(value);
    if (Object.hasOwn(value, '$content')) {
      if (entries.length !== 1 || typeof entries[0][1] !== 'string')
        throw new AuthoringError(
          location,
          'object containing only a string $content',
          value,
          'A content reference must contain only $content',
        );
      const reference = entries[0][1];
      if (active.has(reference))
        throw new AuthoringError(
          `${location}.$content`,
          'acyclic reference',
          reference,
          `Cyclic JSON content: ${reference}`,
        );
      const { file, pointer } = parseContentReference(
        reference,
        `${location}.$content`,
      );
      if (!Object.hasOwn(assets, file))
        throw new AuthoringError(
          `${location}.$content`,
          'existing content asset',
          reference,
          `Missing JSON content: ${file}`,
        );
      active.add(reference);
      const resolved = visit(
        selectPointer(assets[file], pointer, `${location}.$content`),
        depth + 1,
        location,
      );
      active.delete(reference);
      return resolved;
    }
    return Object.fromEntries(
      entries.map(([key, entry]) => [
        key,
        visit(entry, depth + 1, `${location}.${key}`),
      ]),
    );
  };
  const resolved = visit(source, 0, 'game.json');
  assertAuthorJson(resolved);
  return resolved;
}

function parseContentReference(
  reference: string,
  location: string,
  allowPointer = true,
) {
  const [file, pointer = '', extra] = reference.split('#');
  if (
    reference.length > 512 ||
    extra !== undefined ||
    !/^content\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.json$/.test(file) ||
    (!allowPointer && reference.includes('#')) ||
    (pointer !== '' && !pointer.startsWith('/'))
  )
    throw new AuthoringError(
      location,
      'content/*.json with an optional JSON pointer',
      reference,
      `Invalid JSON content reference: ${reference}`,
    );
  return { file, pointer };
}

function selectPointer(
  source: unknown,
  pointer: string,
  location: string,
): unknown {
  let current = source;
  if (!pointer) return current;
  for (const segment of pointer.slice(1).split('/')) {
    if (/~(?![01])/.test(segment))
      throw new AuthoringError(
        location,
        'valid JSON pointer escape',
        pointer,
        'Invalid JSON pointer escape',
      );
    const key = segment.replaceAll('~1', '/').replaceAll('~0', '~');
    if (
      ['__proto__', 'prototype', 'constructor'].includes(key) ||
      (Array.isArray(current) && !/^(0|[1-9][0-9]*)$/.test(key)) ||
      current === null ||
      typeof current !== 'object' ||
      !Object.hasOwn(current, key)
    )
      throw new AuthoringError(
        location,
        'existing safe JSON pointer',
        pointer,
        `Missing JSON content pointer: ${pointer}`,
      );
    current = Reflect.get(current, key);
  }
  return current;
}
