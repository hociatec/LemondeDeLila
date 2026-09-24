'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { inspectBoundary, audit } = require('./extension-api-boundary.cjs');
test('type imports, aliases, exports and dynamic imports cannot reverse boundaries', () => {
  const fixtures = [
    [
      'src/game/engine/runtime/definitions/example.ts',
      "throw new Error('bad JSON');",
    ],
    [
      'src/game/engine/sdk/extension-contracts.ts',
      "export { createAction } from '../runtime/actions/action-builders';",
    ],
    [
      'src/game/rules/recipes/a.ts',
      "import type { X } from '../game-specific/board/program';",
    ],
    [
      'src/game/rules/recipes/a.ts',
      "export type { X } from '@game/rules/game-specific/board/program';",
    ],
    [
      'src/game/rules/game-specific/board/a.ts',
      "const x = import('../../../engine/runtime/kits/board');",
    ],
    [
      'src/game/engine/sdk/a.ts',
      "export { X } from '../../core/domain/errors/x';",
    ],
    [
      'src/game/engine/runtime/contracts/a.spec.ts',
      "const x = require('../../../rules/public-api');",
    ],
  ];
  for (const [file, source] of fixtures)
    assert.equal(inspectBoundary(file, source).length, 1);
  assert.deepEqual(
    inspectBoundary(
      'src/game/rules/game-specific/board/a.ts',
      "import type { X } from '../../../engine/sdk/extension-contracts';",
    ),
    [],
  );
});
test('the complete source tree respects the extension boundaries', () =>
  audit());
