'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const { captureContract, compareContracts } = require('./sdk-contract-check.cjs');

function fixture(run) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lila-sdk-contract-'));
  const write = (file, body) => fs.writeFileSync(path.join(directory, file), body);
  const capture = () => captureContract({ directory, entry: path.join(directory, 'sdk.ts'),
    options: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.CommonJS,
      moduleResolution: ts.ModuleResolutionKind.Node10, strict: true, types: [], skipLibCheck: true } });
  try { run({ directory, write, capture }); }
  finally {
    assert.equal(path.dirname(directory), path.resolve(os.tmpdir()));
    assert(path.basename(directory).startsWith('lila-sdk-contract-'));
    fs.rmSync(directory, { recursive: true });
  }
}

test('detects transitive payload, return, readonly and optional changes without renaming exports', () => {
  fixture(({ write, capture }) => {
    write('sdk.ts', "export { execute } from './action';");
    write('action.ts', "import type { Payload } from './payload'; export function execute(input: Payload): number { return input.value; }");
    write('payload.ts', 'export interface Payload { readonly value: number; label?: string }');
    const before = capture().snapshot;
    for (const body of [
      'export interface Payload { readonly value: number; label?: number }',
      'export interface Payload { value: number; label?: string }',
      'export interface Payload { readonly value: number; label: string }',
    ]) {
      write('payload.ts', body);
      assert.deepEqual(compareContracts(before, capture().snapshot), ['payload.ts']);
    }
    write('payload.ts', 'export interface Payload { readonly value: number; label?: string }');
    write('action.ts', "import type { Payload } from './payload'; export function execute(input: Payload): string { return String(input.value); }");
    assert.deepEqual(compareContracts(before, capture().snapshot), ['action.ts']);
  });
});

test('captures generic constraints and defaults, overloads and tuple rest parameters', () => {
  fixture(({ write, capture }) => {
    write('sdk.ts', 'export declare function choose<T extends string = "a">(...args: [T, number?]): T;');
    const before = capture().snapshot;
    for (const body of [
      'export declare function choose<T extends string | number = "a">(...args: [T, number?]): T;',
      'export declare function choose<T extends string = "b">(...args: [T, number?]): T;',
      'export declare function choose<T extends string = "a">(...args: [T, number]): T;',
      'export declare function choose<T extends string = "a">(...args: [T, number?]): T; export declare function choose(value: number): number;',
    ]) {
      write('sdk.ts', body);
      assert.deepEqual(compareContracts(before, capture().snapshot), ['sdk.ts']);
    }
  });
});

test('follows import types, re-export barrels and cyclic declaration dependencies', () => {
  fixture(({ write, capture }) => {
    write('sdk.ts', "export type { Node } from './barrel';");
    write('barrel.ts', "export type { Node } from './node';");
    write('node.ts', "export interface Node { next?: import('./edge').Edge }");
    write('edge.ts', "export interface Edge { node: import('./node').Node; weight: number }");
    const before = capture().snapshot;
    assert.equal(before.files.length, 4);
    write('edge.ts', "export interface Edge { node: import('./node').Node; weight: string }");
    assert.deepEqual(compareContracts(before, capture().snapshot), ['edge.ts']);
  });
});

test('ignores implementation bodies and unrelated modules, and emits no files on disk', () => {
  fixture(({ directory, write, capture }) => {
    write('sdk.ts', 'export function score(value: number): number { return value + 1; }');
    const before = capture().snapshot;
    write('sdk.ts', '// implementation only\nexport function score(value: number): number { return value * 2; }');
    write('unrelated.ts', 'export interface Unrelated { value: string }');
    assert.deepEqual(compareContracts(before, capture().snapshot), []);
    assert(!fs.existsSync(path.join(directory, '.sdk-contract-memory')));
  });
});

test('captures mapped author capabilities when an underlying controller signature changes', () => {
  fixture(({ write, capture }) => {
    write('sdk.ts', "import type { Controller } from './controller'; export type Capability = Pick<Controller, keyof Controller>;");
    write('controller.ts', 'export declare class Controller { private state; add(value: number): void; }');
    const before = capture().snapshot;
    write('controller.ts', 'export declare class Controller { private state; add(value: string): void; }');
    assert.deepEqual(compareContracts(before, capture().snapshot), ['controller.ts']);
  });
});

test('snapshots are portable across workspace paths and compiler errors cannot refresh them', () => {
  let first;
  for (let index = 0; index < 2; index++) fixture(({ directory, write, capture }) => {
    write('sdk.ts', 'export interface Public { readonly value: number }');
    const current = capture().snapshot;
    assert(!JSON.stringify(current).includes(directory));
    if (first) assert.deepEqual(current, first);
    else first = current;
    write('sdk.ts', 'export const invalid: number = "no";');
    assert.throws(capture, /not assignable/);
  });
});
