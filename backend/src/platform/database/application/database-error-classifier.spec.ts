import { isUniqueConstraintViolation } from './database-error-classifier';

describe('database error classifier', () => {
  it.each([
    { code: 'ER_DUP_ENTRY' },
    { errno: 1062 },
    { driverError: { code: 'ER_DUP_ENTRY', errno: 1062 } },
  ])('recognizes MySQL duplicate errors including wrapped errors', (error) => {
    expect(isUniqueConstraintViolation(error)).toBe(true);
  });

  it.each([null, new Error('timeout'), { code: 'ER_LOCK_WAIT_TIMEOUT' }])(
    'does not misclassify unrelated failures',
    (error) => expect(isUniqueConstraintViolation(error)).toBe(false),
  );
});
