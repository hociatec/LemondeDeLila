#!/usr/bin/env node
/* eslint-disable no-console */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const repositoryRoot = path.resolve(__dirname, '../..');
const workflowsRoot = path.join(repositoryRoot, '.github/workflows');
const violations = [];

const workflowNames = fs.existsSync(workflowsRoot)
  ? fs.readdirSync(workflowsRoot)
  : [];

function readWorkflow(name) {
  const filename = path.join(workflowsRoot, name);
  if (!fs.existsSync(filename)) return null;
  return fs.readFileSync(filename, 'utf8');
}

for (const name of workflowNames) {
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

const quality = readWorkflow('backend-quality.yml');
if (quality !== null && !/push:\s*\n\s*branches:\s*\[main\]/.test(quality)) {
  violations.push('backend-quality.yml: push sur main absent');
}
for (const required of [
  '.github/CODEOWNERS',
  '.github/dependabot.yml',
]) {
  if (!fs.existsSync(path.join(repositoryRoot, required))) {
    violations.push(`${required}: fichier de gouvernance absent`);
  }
}

for (const deploymentWorkflow of ['backend-deploy.yml', 'release-main.yml']) {
  const source = readWorkflow(deploymentWorkflow);
  if (source === null) continue;
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
