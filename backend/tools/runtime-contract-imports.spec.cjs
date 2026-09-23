'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { hasHigherLayerValueImport } = require('./runtime-contract-imports.cjs');

test('contract import checks respect statement and type boundaries', () => {
  for (const source of [
    "import { codec } from './codec'; import type { Action } from '../actions/action';",
    "import { type Action } from '../actions/action';",
    "export type { Action } from '../actions/action';",
    "export { type Action } from '../actions/action';",
  ])
    assert.equal(hasHigherLayerValueImport(source), false, source);
  for (const source of [
    "import { Action } from '../actions/action';",
    "import '../actions/action';",
    "export * from '../actions/action';",
    "import * as actions from '../actions/action';",
    "import { type Shape, run } from '../actions/action';",
  ])
    assert.equal(hasHigherLayerValueImport(source), true, source);
});
