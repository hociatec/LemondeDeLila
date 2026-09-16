import fs from 'node:fs';
import path from 'node:path';

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || !process.argv[index + 1]) throw new Error(`Argument requis: ${name}`);
  return path.resolve(process.argv[index + 1]);
}

function filesIn(directory, suffix) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const resolved = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesIn(resolved, suffix);
    return entry.name.endsWith(suffix) ? [resolved] : [];
  });
}

function matches(text, expression, mapper) {
  return new Set(Array.from(text.matchAll(expression), mapper));
}

function difference(expected, actual) {
  return [...expected].filter((value) => !actual.has(value)).sort();
}

const backend = argument('--backend-root');
const client = argument('--client-root');
const catalogFiles = filesIn(path.join(client, 'src/modules/admin/domain'), '.cpp')
  .filter((file) => path.basename(file).startsWith('AdminCommandCatalog'));
const catalog = catalogFiles.map((file) => fs.readFileSync(file, 'utf8')).join('\n');

const adminRoutesFile = path.join(
  backend,
  'src/modules/admin/infrastructure/presentation/ws/admin-ws-routes.ts',
);
const adminRoutes = fs.readFileSync(adminRoutesFile, 'utf8');
const backendWs = matches(adminRoutes, /WS_EVENTS\.admin\.([A-Za-z0-9_.]+)/g,
  (match) => match[1].toLowerCase());
const clientWs = matches(catalog, /ws::admin::([A-Za-z0-9_:]+)/g,
  (match) => match[1].replaceAll('::', '.').toLowerCase());

const controllers = filesIn(path.join(backend, 'src'), '.controller.ts');
const backendHttp = new Set();
for (const file of controllers) {
  const source = fs.readFileSync(file, 'utf8');
  const controller = source.match(/@Controller\(\s*['"]([^'"]+)['"]\s*\)/);
  if (!controller || !controller[1].startsWith('api/admin')) continue;
  for (const route of source.matchAll(/@(Get|Post|Patch|Put|Delete)\(\s*(?:['"]([^'"]*)['"])?\s*\)/g)) {
    const suffix = route[2] ? `/${route[2]}` : '';
    backendHttp.add(`${route[1].toUpperCase()} /${controller[1]}${suffix}`
      .replaceAll(/:([A-Za-z0-9_]+)/g, '{$1}'));
  }
}
const clientHttp = matches(catalog,
  /"((?:GET|POST|PATCH|PUT|DELETE) \/api\/admin[^"\s]*)"/g,
  (match) => match[1]);

// The HTTP users API deliberately supersedes the older WS duplicates.
const wsEquivalents = new Map([
  ['users.list', 'GET /api/admin/users'],
  ['users.get', 'GET /api/admin/users/{id}'],
  ['users.ban', 'POST /api/admin/users/{id}/ban'],
  ['users.unban', 'POST /api/admin/users/{id}/unban'],
  ['users.delete', 'DELETE /api/admin/users/{id}'],
  ['users.roles', 'PATCH /api/admin/users/{id}'],
]);
for (const [event, operation] of wsEquivalents)
  if (clientHttp.has(operation)) clientWs.add(event);

const threadHandler = fs.readFileSync(path.join(
  backend,
  'src/modules/notification/infrastructure/presentation/ws/notification-ws-inbox-thread.handler.ts',
), 'utf8');
const threadBlock = threadHandler.match(/const THREAD_EVENTS[\s\S]*?\]\);/)?.[0] ?? '';
const backendStaffNotify = matches(threadBlock, /WS_EVENTS\.notify\.inbox\.([A-Za-z0-9_]+)/g,
  (match) => match[1].toLowerCase());
backendStaffNotify.add('reply');
const clientStaffNotify = matches(catalog, /ws::notify::inbox::([A-Za-z0-9_]+)/g,
  (match) => match[1].toLowerCase());

// A catalog command alone is not enough: report actions must be reachable.
const itemActions = fs.readFileSync(path.join(
  client, 'src/modules/admin/presentation/AdminFrame.ItemActions.cpp',
), 'utf8');
const reportActions = itemActions.match(
  /kind == domain::AdminItemKind::BugReport\)[\s\S]*?(?=else if)/,
)?.[0] ?? '';
const reportCommands = matches(reportActions, /add\("([^"]+)"/g,
  (match) => match[1]);

const failures = [
  ['actions accessibles des rapports', difference(
    new Set(['bugs.get', 'bugs.delete', 'bugs.update', 'bugs.status']), reportCommands)],
  ['routes HTTP admin', difference(backendHttp, clientHttp)],
  ['événements WebSocket admin', difference(backendWs, clientWs)],
  ['workflow de contacts staff', difference(backendStaffNotify, clientStaffNotify)],
].filter(([, missing]) => missing.length > 0);

if (failures.length > 0) {
  for (const [kind, missing] of failures)
    process.stderr.write(`${kind} non couverts:\n${missing.map((item) => `  - ${item}`).join('\n')}\n`);
  process.exit(1);
}

process.stdout.write(
  `Couverture admin vérifiée: ${backendHttp.size} routes HTTP, ` +
  `${backendWs.size} routes WS admin et ${backendStaffNotify.size} commandes contacts staff.\n`,
);
