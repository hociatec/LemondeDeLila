'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { ESLint } = require('eslint');

test('business rules require an injected clock while explicit date conversion stays allowed', async () => {
  const eslint = new ESLint();
  for (const filePath of [
    'src/modules/user/domain/policies/user-ban.policy.ts',
    'src/modules/room/application/services/lifecycle/room-lifecycle.service.ts',
    'src/game/core/application/services/game-task-dispatch.service.ts',
    'src/game/engine/runtime/kits/grid-kit.ts',
  ]) {
    for (const source of ['const now = Date.now();', 'const now = new Date();', 'const now = Date();']) {
      const [result] = await eslint.lintText(source, { filePath });
      assert(result.messages.some(message => message.ruleId === 'no-restricted-syntax'), `${filePath}: ${source}`);
    }
    for (const source of ['const date = new Date(input);', 'const now = clock.now();']) {
      const [result] = await eslint.lintText(source, { filePath });
      assert(!result.messages.some(message => message.ruleId === 'no-restricted-syntax'), `${filePath}: ${source}`);
    }
  }
});
