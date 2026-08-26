import fs from 'node:fs';
import path from 'node:path';

function argument(name) {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) {
    throw new Error(`Argument obligatoire absent: ${name}`);
  }
  return path.resolve(process.argv[index + 1]);
}

const backendRoot = argument('--backend-root');
const outputRoot = argument('--output-root');
const eventsPath = path.join(
  backendRoot,
  'src/realtime/infrastructure/presentation/ws/ws-events.ts',
);
const fieldsPath = path.join(backendRoot, 'contracts/client-wx-fields.json');

for (const requiredPath of [eventsPath, fieldsPath]) {
  if (!fs.statSync(requiredPath, { throwIfNoEntry: false })?.isFile()) {
    throw new Error(`Contrat backend introuvable: ${requiredPath}`);
  }
}

function writeGenerated(fileName, content) {
  const destination = path.join(outputRoot, fileName);
  const normalized = `${content.replace(/\r\n/g, '\n').trimEnd()}\n`;
  const existing = fs.existsSync(destination)
    ? fs.readFileSync(destination, 'utf8').replace(/\r\n/g, '\n')
    : null;
  if (existing !== normalized) fs.writeFileSync(destination, normalized);
}

function cppIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Identifiant de contrat invalide: '${value}'`);
  }
  return `${value[0].toUpperCase()}${value.slice(1)}`;
}

function cppString(value) {
  return String(value).replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function parseEvents(source) {
  const root = [];
  const containers = [root];
  let started = false;
  let finished = false;
  for (const line of source.split(/\r?\n/)) {
    if (!started) {
      if (/^\s*export\s+const\s+WS_EVENTS\s*=\s*{\s*$/.test(line)) started = true;
      continue;
    }
    const namespaceMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*{\s*$/);
    if (namespaceMatch) {
      const children = [];
      containers.at(-1).push({ kind: 'namespace', name: namespaceMatch[1], children });
      containers.push(children);
      continue;
    }
    const valueMatch = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*'([^']+)'\s*,?\s*$/);
    if (valueMatch) {
      containers.at(-1).push({ kind: 'value', name: valueMatch[1], value: valueMatch[2] });
      continue;
    }
    if (/^\s*}\s*(?:as\s+const)?\s*;?\s*$/.test(line) || /^\s*},?\s*$/.test(line)) {
      if (containers.length === 1) {
        finished = true;
        break;
      }
      containers.pop();
      continue;
    }
    if (line.trim()) throw new Error(`Syntaxe WS_EVENTS non prise en charge: ${line}`);
  }
  if (!started || !finished || root.length === 0) {
    throw new Error(`Impossible d'analyser WS_EVENTS dans ${eventsPath}`);
  }
  return root;
}

function renderEvents(nodes, lines) {
  for (const node of nodes) {
    if (node.kind === 'namespace') {
      lines.push(`namespace ${node.name}`, '{');
      renderEvents(node.children, lines);
      lines.push('}', '');
    } else {
      lines.push(
        `inline constexpr std::string_view ${cppIdentifier(node.name)} = "${cppString(node.value)}";`,
      );
    }
  }
}

fs.mkdirSync(outputRoot, { recursive: true });
const eventLines = [
  '// Generated from backend WS_EVENTS. Do not edit manually.',
  '#pragma once',
  '',
  '#include <string_view>',
  '',
  'namespace lila::shared::network::ws::types',
  '{',
];
renderEvents(parseEvents(fs.readFileSync(eventsPath, 'utf8')), eventLines);
eventLines.push('}');
writeGenerated('WsMessageTypes.generated.h', eventLines.join('\n'));

const manifest = JSON.parse(fs.readFileSync(fieldsPath, 'utf8'));
if (!Array.isArray(manifest.headers) || manifest.headers.length === 0) {
  throw new Error(`Le manifeste ne contient aucun header: ${fieldsPath}`);
}
const seenFiles = new Set();
for (const header of manifest.headers) {
  if (seenFiles.has(header.file)) throw new Error(`Header duplique: ${header.file}`);
  seenFiles.add(header.file);
  const lines = [
    '// Generated from backend/contracts/client-wx-fields.json. Do not edit manually.',
    '#pragma once',
    '',
    ...header.includes.map((include) => `#include <${include}>`),
    '',
    `namespace ${header.namespace}`,
    '{',
  ];
  const seenConstants = new Set();
  for (const constant of header.constants) {
    if (seenConstants.has(constant.name)) {
      throw new Error(`Constante dupliquee dans ${header.file}: ${constant.name}`);
    }
    seenConstants.add(constant.name);
    if (constant.type === 'std::string_view') {
      lines.push(
        `inline constexpr ${constant.type} ${constant.name} = "${cppString(constant.value)}";`,
      );
    } else if (constant.type === 'int' || constant.type === 'std::size_t') {
      if (!Number.isSafeInteger(Number(constant.value))) {
        throw new Error(`Valeur numerique invalide: ${constant.name}`);
      }
      lines.push(`inline constexpr ${constant.type} ${constant.name} = ${constant.value};`);
    } else {
      throw new Error(`Type de constante non pris en charge: ${constant.type}`);
    }
  }
  lines.push('}');
  writeGenerated(header.file, lines.join('\n'));
}
