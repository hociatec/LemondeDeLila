import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import type {
  DeclarativeGameDefinition,
  GameActionShape,
} from '../application/runtime/game-definition';
import type { GameComponentDefinition } from '../application/runtime/component-kit';

export type BackendDebtAuditViolation = {
  file?: string;
  gameId?: string;
  criterion: string;
  message: string;
};

export type BackendDebtGameMetrics = {
  gameId: string;
  contentLoc: number;
  declarativeLoc: number;
  customRulesLoc: number;
};

const STATE_OWNERSHIP_FIELDS: Readonly<Record<string, readonly RegExp[]>> = {
  'movement.track': [/\bpositions?\b/i, /\bcurrentPosition\b/i],
  'cards.deck': [/\bdeck\b/i, /\bdiscard\b/i, /\bhand\b/i],
  'cards.hands': [/\bhand\b/i, /\bhands\b/i],
  'dice.set': [/\blastRoll\b/i, /\bdice\b/i],
  'score.track': [/\bscore\b/i, /\bscores\b/i],
  'turn.policy': [/\bskipTurns?\b/i, /\bextraTurns?\b/i],
};

const GAME_IMPORT_ALLOWLIST = [
  '../../../core/application/public-api',
  '../../core/application/public-api',
  '../core/application/public-api',
];

export function auditGameStateOwnership(input: {
  gameId: string;
  stateSource: string;
  components: readonly GameComponentDefinition[];
  exceptions?: readonly string[];
}): BackendDebtAuditViolation[] {
  const violations: BackendDebtAuditViolation[] = [];
  const stateSource = extractStateDeclarations(input.stateSource);
  const exceptions = new Set(input.exceptions ?? []);
  for (const component of input.components) {
    for (const pattern of STATE_OWNERSHIP_FIELDS[component.component] ?? []) {
      if (exceptions.has(pattern.source)) continue;
      if (!pattern.test(stateSource)) continue;
      violations.push({
        gameId: input.gameId,
        criterion: 'state-ownership',
        message: `${component.component}:${component.id} possède déjà ${pattern.source}`,
      });
    }
  }
  return violations;
}

export function gameSpecificState(
  ...fields: readonly string[]
): readonly string[] {
  return Object.freeze([...fields]);
}

export function auditGameImportBoundaries(input: {
  file: string;
  source: string;
}): BackendDebtAuditViolation[] {
  const imports = [...input.source.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)].map(
    (match) => match[1],
  );
  return imports
    .filter((specifier) => specifier.startsWith('.'))
    .filter((specifier) => specifier.includes('/core/'))
    .filter(
      (specifier) =>
        !GAME_IMPORT_ALLOWLIST.some(
          (allowed) =>
            specifier === allowed || specifier.startsWith(`${allowed}/`),
        ),
    )
    .map((specifier) => ({
      file: input.file,
      criterion: 'game-import-boundary',
      message: `Import non autorisé depuis un jeu: ${specifier}`,
    }));
}

export function assertAutomaticRulesAreIdempotent<TState extends object>(
  definition: DeclarativeGameDefinition<
    TState,
    Readonly<Record<string, GameActionShape<TState>>>,
    object
  >,
): void {
  const ids = new Set<string>();
  for (const rule of definition.automatic ?? []) {
    if (ids.has(rule.id)) {
      throw new Error(`Règle automatique dupliquée: ${rule.id}`);
    }
    ids.add(rule.id);
  }
}

export function auditPhaseReachability(definition: {
  id: string;
  initialPhase?: string;
  phases?: Readonly<Record<string, { next?: string }>>;
}): BackendDebtAuditViolation[] {
  const phases = Object.keys(definition.phases ?? {});
  const initial = definition.initialPhase ?? phases[0] ?? 'playing';
  const reachable = new Set<string>([initial]);
  for (let changed = true; changed;) {
    changed = false;
    for (const phase of [...reachable]) {
      const next = definition.phases?.[phase]?.next;
      if (next && !reachable.has(next)) {
        reachable.add(next);
        changed = true;
      }
    }
  }
  return phases
    .filter((phase) => !reachable.has(phase))
    .map((phase) => ({
      gameId: definition.id,
      criterion: 'phase-reachability',
      message: `Phase inaccessible: ${phase}`,
    }));
}

export function repeatedFunctionNames(
  files: readonly { file: string; source: string }[],
  threshold = 3,
): Array<{ name: string; count: number; files: string[] }> {
  const byName = new Map<string, Set<string>>();
  for (const file of files) {
    for (const match of file.source.matchAll(/\bfunction\s+([A-Za-z0-9_]+)/g)) {
      const name = match[1];
      if (name.length < 4) continue;
      (byName.get(name) ?? byName.set(name, new Set()).get(name))?.add(
        file.file,
      );
    }
  }
  return [...byName.entries()]
    .map(([name, names]) => ({ name, count: names.size, files: [...names] }))
    .filter((entry) => entry.count >= threshold)
    .sort(
      (left, right) =>
        right.count - left.count || left.name.localeCompare(right.name),
    );
}

export function gameSpecificMetrics(input: {
  gameId: string;
  contentFiles?: readonly string[];
  gameFile?: string;
  rulesFile?: string;
}): BackendDebtGameMetrics {
  return {
    gameId: input.gameId,
    contentLoc: countLoc(input.contentFiles ?? []),
    declarativeLoc: countLoc(input.gameFile ? [input.gameFile] : []),
    customRulesLoc: countLoc(input.rulesFile ? [input.rulesFile] : []),
  };
}

export function readSource(root: string, file: string): string {
  return readFileSync(file.startsWith('/') ? file : `${root}/${file}`, 'utf8');
}

export function workspaceRelative(root: string, file: string): string {
  return relative(root, file).replaceAll('\\', '/');
}

function countLoc(files: readonly string[]): number {
  return files.reduce((sum, file) => {
    const source = readFileSync(file, 'utf8');
    return (
      sum +
      source
        .split(/\r?\n/)
        .filter((line) => line.trim() && !line.trim().startsWith('//')).length
    );
  }, 0);
}

function extractStateDeclarations(source: string): string {
  const blocks = [
    ...source.matchAll(/export\s+interface\s+\w*State\s*\{[\s\S]*?\n\}/g),
    ...source.matchAll(/export\s+type\s+\w*State\s*=[^;]+;/g),
  ].map((match) => match[0]);
  return blocks.join('\n');
}
