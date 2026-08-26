#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const repoRoot = path.resolve(__dirname, '..');
const defaultRoot = path.join(repoRoot, 'src');
const contractFile = path.join(__dirname, 'structural-quality-contract.json');
const baselineFile = path.join(__dirname, 'structural-quality-baseline.json');

function normalizeSlashes(value) {
  return value.split(path.sep).join('/');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function walkTypeScriptFiles(root, contract) {
  const files = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.name.endsWith('.ts')) continue;
      const relative = `/${normalizeSlashes(path.relative(root, fullPath))}`;
      if (
        contract.ignoredSuffixes.some((suffix) =>
          entry.name.endsWith(suffix),
        ) ||
        contract.ignoredPathFragments.some((fragment) =>
          relative.includes(fragment),
        )
      ) {
        continue;
      }
      files.push(fullPath);
    }
  };
  visit(root);
  return files.sort();
}

function nodeLines(sourceFile, node) {
  const start = sourceFile.getLineAndCharacterOfPosition(
    node.getStart(sourceFile),
  ).line;
  const end = sourceFile.getLineAndCharacterOfPosition(node.end).line;
  return end - start + 1;
}

function nodeStartLine(sourceFile, node) {
  return (
    sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  );
}

function memberName(member, sourceFile) {
  return member.name?.getText(sourceFile) ?? '<anonymous>';
}

function isConstructorDependencyExempt(relative, contract) {
  return contract.constructorDependencyExemptions.some((pattern) =>
    new RegExp(pattern).test(relative),
  );
}

function createViolation({
  rule,
  file,
  subject,
  line,
  actual,
  limit,
}) {
  return { rule, file, subject, line, actual, limit };
}

function analyzeFile(filePath, options) {
  const { root, contract } = options;
  const source = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const relative = normalizeSlashes(path.relative(root, filePath));
  const limits = contract.limits;
  const violations = [];
  const fileLines = source.split(/\r?\n/).length;

  const checkFunction = (node, subject) => {
    const lines = nodeLines(sourceFile, node);
    if (lines <= limits.methodLines) return;
    violations.push(
      createViolation({
        rule: 'function-lines',
        file: relative,
        subject,
        line: nodeStartLine(sourceFile, node),
        actual: lines,
        limit: limits.methodLines,
      }),
    );
  };

  if (fileLines > limits.fileLines) {
    violations.push(
      createViolation({
        rule: 'file-lines',
        file: relative,
        subject: null,
        line: 1,
        actual: fileLines,
        limit: limits.fileLines,
      }),
    );
  }

  const visit = (node) => {
    if (ts.isFunctionDeclaration(node)) {
      checkFunction(node, node.name?.text ?? '<anonymous>');
    } else if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) ||
        ts.isFunctionExpression(node.initializer))
    ) {
      checkFunction(node.initializer, node.name.getText(sourceFile));
    }

    if (!ts.isClassDeclaration(node)) {
      ts.forEachChild(node, visit);
      return;
    }

    const className = node.name?.text ?? '<anonymous>';
    const classLines = nodeLines(sourceFile, node);
    if (classLines > limits.classLines) {
      violations.push(
        createViolation({
          rule: 'class-lines',
          file: relative,
          subject: className,
          line: nodeStartLine(sourceFile, node),
          actual: classLines,
          limit: limits.classLines,
        }),
      );
    }

    const methods = node.members.filter(ts.isMethodDeclaration);
    if (methods.length > limits.methodsPerClass) {
      violations.push(
        createViolation({
          rule: 'methods-per-class',
          file: relative,
          subject: className,
          line: nodeStartLine(sourceFile, node),
          actual: methods.length,
          limit: limits.methodsPerClass,
        }),
      );
    }

    if (!isConstructorDependencyExempt(`/${relative}`, contract)) {
      const constructor = node.members.find(ts.isConstructorDeclaration);
      const dependencies = constructor?.parameters.length ?? 0;
      if (dependencies > limits.constructorDependencies) {
        violations.push(
          createViolation({
            rule: 'constructor-dependencies',
            file: relative,
            subject: className,
            line: constructor
              ? nodeStartLine(sourceFile, constructor)
              : nodeStartLine(sourceFile, node),
            actual: dependencies,
            limit: limits.constructorDependencies,
          }),
        );
      }
    }

    for (const method of methods) {
      const lines = nodeLines(sourceFile, method);
      ts.forEachChild(method, visit);
      if (lines <= limits.methodLines) continue;
      violations.push(
        createViolation({
          rule: 'method-lines',
          file: relative,
          subject: `${className}.${memberName(method, sourceFile)}`,
          line: nodeStartLine(sourceFile, method),
          actual: lines,
          limit: limits.methodLines,
        }),
      );
    }
  };
  visit(sourceFile);
  return violations;
}

function violationKey(violation) {
  return [violation.rule, violation.file, violation.subject ?? ''].join(':');
}

function analyzeStructure({
  root = defaultRoot,
  contract = readJson(contractFile),
} = {}) {
  const files = walkTypeScriptFiles(root, contract);
  const violations = files
    .flatMap((filePath) => analyzeFile(filePath, { root, contract }))
    .sort((left, right) => violationKey(left).localeCompare(violationKey(right)));
  return { files: files.length, violations };
}

function compareWithBaseline(current, baseline) {
  const previousByKey = new Map(
    (baseline.violations ?? []).map((violation) => [
      violationKey(violation),
      violation,
    ]),
  );
  const regressions = [];
  for (const violation of current) {
    const previous = previousByKey.get(violationKey(violation));
    if (!previous || violation.actual > previous.actual) {
      regressions.push({ ...violation, previous: previous?.actual ?? null });
    }
  }
  return regressions;
}

function summarizeByRule(violations) {
  const summary = {};
  for (const violation of violations) {
    summary[violation.rule] = (summary[violation.rule] ?? 0) + 1;
  }
  return summary;
}

function writeBaseline(analysis, contract) {
  const payload = {
    schemaVersion: 1,
    contractVersion: contract.schemaVersion,
    generatedAt: new Date().toISOString(),
    violations: analysis.violations,
  };
  fs.writeFileSync(baselineFile, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
}

function printViolation(violation) {
  const subject = violation.subject ? ` (${violation.subject})` : '';
  const previous =
    violation.previous == null ? 'nouvelle' : `précédent ${violation.previous}`;
  console.error(
    `- ${violation.rule}: ${violation.file}:${violation.line}${subject} = ${violation.actual}, limite ${violation.limit} (${previous})`,
  );
}

function main() {
  const contract = readJson(contractFile);
  const analysis = analyzeStructure({ contract });
  if (process.argv.includes('--update-baseline')) {
    writeBaseline(analysis, contract);
    console.log(
      `structural-quality: baseline mise à jour (${analysis.violations.length} dettes explicites)`,
    );
    return;
  }

  if (!fs.existsSync(baselineFile)) {
    console.error(
      'structural-quality: baseline absente, exécuter npm run structure:baseline:update',
    );
    process.exitCode = 2;
    return;
  }
  const baseline = readJson(baselineFile);
  const regressions = compareWithBaseline(analysis.violations, baseline);
  const summary = summarizeByRule(analysis.violations);
  console.log(
    `structural-quality: ${analysis.files} fichiers, ${analysis.violations.length} dettes`,
  );
  for (const [rule, count] of Object.entries(summary)) {
    console.log(`- ${rule}: ${count}`);
  }
  if (regressions.length > 0) {
    console.error(`structural-quality: ${regressions.length} régression(s)`);
    regressions.forEach(printViolation);
    process.exitCode = 1;
    return;
  }
  console.log('structural-quality: OK (aucune nouvelle dette ni aggravation)');
}

module.exports = {
  analyzeFile,
  analyzeStructure,
  compareWithBaseline,
  isConstructorDependencyExempt,
  nodeLines,
  summarizeByRule,
  violationKey,
};

if (require.main === module) main();
