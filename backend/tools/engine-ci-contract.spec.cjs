'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const YAML = require('yaml');

test('required quality context accepts intentional skips but rejects failures', () => {
  const root = path.resolve(__dirname, '../..');
  const workflow = YAML.parse(
    fs.readFileSync(
      path.join(root, '.github/workflows/backend-architecture.yml'),
      'utf8',
    ),
  );
  const rules = JSON.parse(
    fs.readFileSync(path.join(root, '.github/rulesets/main.json'), 'utf8'),
  );
  const checks = rules.rules.find(
    (rule) => rule.type === 'required_status_checks',
  ).parameters.required_status_checks;
  assert.ok(checks.some((check) => check.context === 'quality'));
  for (const event of ['push', 'pull_request']) {
    assert.ok(Object.hasOwn(workflow.on, event));
    assert.ok(workflow.on[event]?.paths.includes('backend/**'));
    assert.equal(workflow.on[event]?.['paths-ignore'], undefined);
  }
  const quality = workflow.jobs.quality;
  assert.equal(quality.if, 'always()');
  assert.deepEqual(quality.needs, [
    'impact',
    'changed-tests',
    'static',
    'architecture',
    'selected-games',
    'all-games',
    'real-integration',
    'release-artifact',
  ]);
  const step = quality.steps[0];
  assert.equal(step.env.JOB_RESULTS, '${{ toJSON(needs) }}');
  const script = step.run.match(/^node -e "([\s\S]+)"\s*$/)[1];
  const execute = (results) => {
    let failed = false;
    Function(
      'process',
      script,
    )({
      env: { JOB_RESULTS: JSON.stringify(results) },
      exit: (code) => {
        failed = code !== 0;
      },
    });
    return failed;
  };
  const success = Object.fromEntries(
    quality.needs.map((name) => [name, { result: 'success' }]),
  );
  assert.equal(execute(success), false);
  for (const name of quality.needs) {
    assert.equal(execute({ ...success, [name]: { result: 'skipped' } }), false);
    for (const result of ['failure', 'cancelled'])
      assert.equal(execute({ ...success, [name]: { result } }), true);
  }
  assert.ok(
    workflow.jobs['changed-tests'].steps.some(
      (step) => step.run === 'npm run test:changed -- --scope=unit',
    ),
  );
  const pkg = require('../package.json');
  for (const suite of [
    'all-declarative-games.contract',
    'replay-progress',
    'replay-idle-timer',
    'hand-limit-replay',
    'generated-actions.property',
    'directional-hazard-primitives-parity',
    'primitive-json-sdk-parity',
    'simultaneous-quiz-json-parity',
    'independent-capabilities',
    'reference-replays',
    'generated-capability-models.property',
    'json-game-compiler-factory',
    'json-author-codec',
    'json-language-budget',
  ])
    assert.ok(
      pkg.scripts['engine:merge-contracts'].includes(`${suite}.spec.ts`),
    );
  assert.ok(
    workflow.jobs['all-games'].steps.some(
      (step) =>
        typeof step.run === 'string' &&
        step.run.includes('all-declarative-games.contract.spec.ts') &&
        step.run.includes('reference-replays.spec.ts'),
    ),
  );
  assert.match(
    pkg.scripts['engine:authoring-contracts'],
    /diagnostics\|authoring\|origin/,
  );
});
