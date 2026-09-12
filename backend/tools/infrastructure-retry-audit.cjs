const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const sourceRoot = path.join(root, 'src');
const violations = [];

for (const file of productionTypescriptFiles(sourceRoot)) {
  const relative = path.relative(root, file).replaceAll('\\', '/');
  const source = fs.readFileSync(file, 'utf8');
  if (/autoResendUnfulfilledCommands\s*:\s*true/.test(source)) {
    violations.push(
      `${relative}: implicit replay of unacknowledged Redis writes`,
    );
  }
  for (const match of source.matchAll(
    /maxRetriesPerRequest\s*:\s*([^,\r\n}]+)/g,
  )) {
    const value = match[1].trim();
    const bullmqException =
      relative.endsWith('bullmq-game-task-scheduler.service.ts') &&
      value === 'null';
    if (!bullmqException && value !== '0' && value !== '1') {
      violations.push(`${relative}: unbounded Redis request retry (${value})`);
    }
  }
  if (/for\s*\(let\s+attempt\s*=/.test(source)) {
    const boundedAtomicRename =
      relative.endsWith('atomic-file.utils.ts') &&
      /attempt\s*>=\s*5/.test(source) &&
      /\['EPERM', 'EACCES', 'EBUSY'\]/.test(source);
    if (!boundedAtomicRename) {
      violations.push(`${relative}: manual retry loop lacks an approved bound`);
    }
  }
}

requireContract(
  'src/game/core/infrastructure/scheduling/bullmq-game-task-scheduler.service.ts',
  [
    /IDEMPOTENT_TASK_ATTEMPTS\s*=\s*5/,
    /attempts:\s*IDEMPOTENT_TASK_ATTEMPTS/,
    /const jobId = gameTaskJobId\(correlatedTask\)/,
  ],
);
requireContract(
  'src/game/core/application/services/game-realtime-automation.service.ts',
  [/gameTaskCommandId\(task, index\)/, /compareAndSetInternalState\(/],
);
requireContract('src/platform/redis/infrastructure/redis-client.factory.ts', [
  /\.\.\.\(options \?\? \{\}\)[\s\S]*maxRetriesPerRequest:\s*1[\s\S]*autoResendUnfulfilledCommands:\s*false/,
]);

if (violations.length > 0) {
  console.error(violations.join('\n'));
  process.exitCode = 1;
} else {
  console.log('infrastructure-retry-audit: OK');
}

function requireContract(relative, patterns) {
  const source = fs.readFileSync(path.join(root, relative), 'utf8');
  for (const pattern of patterns) {
    if (!pattern.test(source))
      violations.push(`${relative}: missing ${pattern}`);
  }
}

function productionTypescriptFiles(directory) {
  const result = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...productionTypescriptFiles(target));
    else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts'))
      result.push(target);
  }
  return result;
}
