'use strict';
const assert = require('node:assert/strict');
const test = require('node:test');
const { ESLint } = require('eslint');

test('production lint rejects double casts including parentheses and angle assertions', async () => {
  const eslint = new ESLint();
  for (const source of [
    'const result = input as unknown as Value;',
    'const result = (input as unknown) as Value;',
    'const result = <Value>(<unknown>input);',
    'const result = <Value>(input as unknown);',
  ]) {
    const [result] = await eslint.lintText(source, {
      filePath:
        'src/modules/health/infrastructure/checks/database-pool-saturation.ts',
    });
    assert(
      result.messages.some(
        (message) => message.ruleId === 'no-restricted-syntax',
      ),
      source,
    );
  }
  const [allowed] = await eslint.lintText('const value: unknown = input;', {
    filePath:
      'src/modules/health/infrastructure/checks/database-pool-saturation.ts',
  });
  assert(
    !allowed.messages.some(
      (message) => message.ruleId === 'no-restricted-syntax',
    ),
  );
  const [gameEngine] = await eslint.lintText(
    'const value = input as unknown as Value;',
    {
      filePath: 'src/game/engine/runtime/recipes/gameplay-recipes.ts',
    },
  );
  assert(
    gameEngine.messages.some(
      (message) => message.ruleId === 'no-restricted-syntax',
    ),
  );
  const [fixture] = await eslint.lintText(
    'const value = input as unknown as Value;',
    {
      filePath:
        'src/game/games/les-quatre-vents/a-fond-les-ballons/game.spec.ts',
    },
  );
  assert(
    !fixture.messages.some(
      (message) => message.ruleId === 'no-restricted-syntax',
    ),
  );
});
