import {
  componentStateOwnership,
  coreStateOwnership,
  type StateOwnershipId,
} from '../../../engine/runtime/state/component-state-ownership';
import { readFileSync } from 'node:fs';
import { relative } from 'node:path';
import ts from 'typescript';
import type {
  CompiledGameDefinition,
  GameActionShape,
} from '../../../engine/runtime/definitions/game-definition';
import type { GameComponentDefinition } from '../../../engine/runtime/definitions/component-kit';

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

const GAME_SDK_PUBLIC_IMPORT = /^(?:\.\.\/){1,3}engine\/sdk\/public-api$/;

export function auditGameStateOwnership(input: {
  gameId: string;
  stateSource: string;
  components: readonly GameComponentDefinition[];
  exceptions?: readonly StateOwnershipId[];
}): BackendDebtAuditViolation[] {
  const violations: BackendDebtAuditViolation[] = [];
  const stateFields = extractStateDeclarations(input.stateSource);
  const exceptions = new Set(input.exceptions ?? []);
  for (const pattern of coreStateOwnership) {
    if (
      !exceptions.has(pattern.id) &&
      pattern.authorAliases.some((alias) =>
        stateFields.has(alias.toLowerCase()),
      )
    )
      violations.push({
        gameId: input.gameId,
        criterion: 'state-ownership',
        message: `Le runtime possède déjà ${pattern.id}`,
      });
  }
  for (const component of input.components) {
    for (const pattern of componentStateOwnership[component.component] ?? []) {
      if (exceptions.has(pattern.id)) continue;
      if (
        !pattern.authorAliases.some((alias) =>
          stateFields.has(alias.toLowerCase()),
        )
      )
        continue;
      violations.push({
        gameId: input.gameId,
        criterion: 'state-ownership',
        message: `${component.component}:${component.id} possède déjà ${pattern.id}`,
      });
    }
  }
  return violations;
}

export function gameSpecificState(
  ...fields: readonly StateOwnershipId[]
): readonly StateOwnershipId[] {
  return Object.freeze([...fields]);
}

function collectGameImports(input: { file: string; source: string }) {
  const ast = ts.createSourceFile(
    input.file,
    input.source,
    ts.ScriptTarget.Latest,
    true,
  );
  const imports: string[] = [];
  const violations: BackendDebtAuditViolation[] = [];
  const report = (message: string) =>
    violations.push({
      file: input.file,
      criterion: 'game-import-boundary',
      message,
    });
  const visit = (node: ts.Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    )
      imports.push(node.moduleSpecifier.text);
    if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteral(node.argument.literal)
    )
      imports.push(node.argument.literal.text);
    if (
      ts.isExternalModuleReference(node) &&
      node.expression &&
      ts.isStringLiteralLike(node.expression)
    )
      imports.push(node.expression.text);
    if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        node.expression.getText(ast) === 'require')
    ) {
      if (
        node.arguments.length === 1 &&
        ts.isStringLiteralLike(node.arguments[0])
      )
        imports.push(node.arguments[0].text);
      else report('Import dynamique non statique interdit');
    }
    if (
      !input.file.endsWith('.spec.ts') &&
      ts.isIdentifier(node) &&
      [
        'process',
        '__dirname',
        '__filename',
        'Date',
        'fetch',
        'WebSocket',
      ].includes(node.text)
    )
      report(`API infrastructure interdite: ${node.text}`);
    if (
      ts.isPropertyAccessExpression(node) &&
      node.expression.getText(ast) === 'Math' &&
      node.name.text === 'random'
    )
      report('Utiliser le RNG injecté du moteur');
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return { imports, violations };
}

export function auditGameImportBoundaries(input: {
  file: string;
  source: string;
}): BackendDebtAuditViolation[] {
  const { imports, violations } = collectGameImports(input);
  return [
    ...violations,
    ...imports
      .filter(
        (specifier) =>
          /(?:^|[\\/])entities?[\\/]|\.entity(?:\.[A-Za-z0-9_-]+)?$/.test(
            specifier,
          ) ||
          (!specifier.startsWith('./') &&
            !GAME_SDK_PUBLIC_IMPORT.test(specifier) &&
            !(
              input.file.endsWith('.spec.ts') &&
              /^(?:\.\.\/)+(?:engine\/(?:testing|json)|rules)\/public-api$/.test(
                specifier,
              )
            )),
      )
      .map((specifier) => ({
        file: input.file,
        criterion: 'game-import-boundary',
        message: `Import non autorisé depuis un jeu: ${specifier}`,
      })),
  ];
}

export function assertAutomaticRulesAreIdempotent<TState extends object>(
  definition: CompiledGameDefinition<
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
  phases?: Readonly<
    Record<string, { next?: string; transitions?: readonly string[] }>
  >;
}): BackendDebtAuditViolation[] {
  const phases = Object.keys(definition.phases ?? {});
  const initial = definition.initialPhase ?? phases[0] ?? 'playing';
  const reachable = new Set<string>([initial]);
  for (let changed = true; changed;) {
    changed = false;
    for (const phase of [...reachable]) {
      const configuration = definition.phases?.[phase];
      const exits = [
        ...(configuration?.transitions ?? []),
        ...(configuration?.next ? [configuration.next] : []),
      ];
      for (const next of exits) {
        if (!reachable.has(next)) {
          reachable.add(next);
          changed = true;
        }
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

function extractStateDeclarations(source: string): ReadonlySet<string> {
  const ast = ts.createSourceFile(
    'state.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
  );
  const fields: string[] = [];
  const collect = (node: ts.Node): void => {
    if (ts.isPropertySignature(node) && node.name)
      fields.push(
        ts.isIdentifier(node.name) || ts.isStringLiteral(node.name)
          ? node.name.text
          : node.name.getText(ast),
      );
    ts.forEachChild(node, collect);
  };
  for (const statement of ast.statements) {
    if (
      (ts.isInterfaceDeclaration(statement) ||
        ts.isTypeAliasDeclaration(statement)) &&
      statement.name.text.endsWith('State')
    )
      collect(statement);
  }
  return new Set(fields.map((field) => field.toLowerCase()));
}
