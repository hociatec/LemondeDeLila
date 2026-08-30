import {
  isUniqueConstraintViolation,
  mapUniqueConstraintViolation,
} from './database-error-classifier';

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

  it('maps only uniqueness failures to the domain-facing error', async () => {
    const conflict = new Error('identity conflict');
    const duplicate = Object.assign(new Error('duplicate identity'), {
      code: 'ER_DUP_ENTRY',
    });
    await expect(
      mapUniqueConstraintViolation(
        async () => Promise.reject(duplicate),
        () => conflict,
      ),
    ).rejects.toBe(conflict);
    const unavailable = new Error('database unavailable');
    await expect(
      mapUniqueConstraintViolation(
        async () => Promise.reject(unavailable),
        () => conflict,
      ),
    ).rejects.toBe(unavailable);
  });
});
