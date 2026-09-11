import { GameRuleViolationError, rejectRule } from './game-domain.errors';

it('keeps the canonical rejection type and separates code, message and details', () => {
  const details = { tileId: 'start' };
  try {
    rejectRule('Translated presentation', details, 'UNKNOWN_TILE');
  } catch (error) {
    expect(error).toBeInstanceOf(GameRuleViolationError);
    expect(error).toMatchObject({
      code: 'UNKNOWN_TILE',
      message: 'Translated presentation',
      details,
    });
    return;
  }
  throw new Error('Expected rejection');
});

it('preserves the default rejection code for existing games', () => {
  expect(() => rejectRule('Unavailable')).toThrow(GameRuleViolationError);
});
