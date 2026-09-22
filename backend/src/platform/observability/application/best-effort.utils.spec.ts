import { bestEffort } from './best-effort.utils';

it('redacts credentials before the Node warning sink, outside the Nest logger', async () => {
  const emit = jest.spyOn(process, 'emitWarning').mockImplementation(() => {});
  try {
    await bestEffort(
      Promise.reject(new Error('redis://user:private-password@host')),
      'cleanup token=private-token',
    );
    expect(emit).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(emit.mock.calls)).not.toMatch(
      /private-password|private-token/,
    );
  } finally {
    emit.mockRestore();
  }
});

it('also redacts custom loggers and preserves successful results', async () => {
  const logger = { warn: jest.fn() };
  await bestEffort(
    Promise.reject(new Error('Authorization: Bearer private-token')),
    'cleanup',
    logger,
  );
  expect(JSON.stringify(logger.warn.mock.calls)).not.toContain('private-token');
  expect(await bestEffort(Promise.resolve(42), 'ok', logger)).toBe(42);
});
