#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../..');
const workflowsRoot = path.join(repositoryRoot, '.github/workflows');
const violations = [];

for (const name of fs.readdirSync(workflowsRoot)) {
  if (!name.endsWith('.yml') && !name.endsWith('.yaml')) continue;
  const relative = `.github/workflows/${name}`;
  const source = fs.readFileSync(path.join(workflowsRoot, name), 'utf8');
  for (const match of source.matchAll(/^\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm)) {
    const reference = match[1];
    if (reference.startsWith('./')) continue;
    if (!/@[a-f0-9]{40}$/.test(reference)) {
      violations.push(
        `${relative}: action non épinglée par SHA (${reference})`,
      );
    }
  }
}

const quality = fs.readFileSync(
  path.join(workflowsRoot, 'backend-quality.yml'),
  'utf8',
);
if (!/push:\s*\n\s*branches:\s*\[main\]/.test(quality)) {
  violations.push('backend-quality.yml: push sur main absent');
}
for (const required of [
  '.github/CODEOWNERS',
  '.github/dependabot.yml',
  '.github/workflows/security.yml',
]) {
  if (!fs.existsSync(path.join(repositoryRoot, required))) {
    violations.push(`${required}: fichier de gouvernance absent`);
  }
}

for (const deploymentWorkflow of ['backend-deploy.yml', 'release-main.yml']) {
  const source = fs.readFileSync(
    path.join(workflowsRoot, deploymentWorkflow),
    'utf8',
  );
  for (const requiredPattern of [
    /artifact:create/,
    /actions\/attest@[a-f0-9]{40}/,
    /sbom-path:/,
    /--artifact-sha256/,
    /actions\/download-artifact@[a-f0-9]{40}/,
  ]) {
    if (!requiredPattern.test(source)) {
      violations.push(
        `${deploymentWorkflow}: promotion d'artefact immuable incomplète (${requiredPattern})`,
      );
    }
  }
  if (/updatecmd backend --source/.test(source)) {
    violations.push(
      `${deploymentWorkflow}: reconstruction backend depuis la source interdite`,
    );
  }
}

if (violations.length > 0) {
  console.error(
    `repository-governance-check: ${violations.length} violation(s)`,
  );
  for (const violation of violations) console.error(`- ${violation}`);
  process.exitCode = 1;
} else {
  console.log('repository-governance-check: OK');
}
