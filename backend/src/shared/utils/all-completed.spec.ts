import { allCompleted } from './all-completed';

it('waits for a sibling mutation after the first branch fails', async () => {
  let finish!: () => void;
  const commit = new Promise<number>((resolve) => {
    finish = () => resolve(42);
  });
  const failure = new Error('first failure');
  let completed = false;
  const joined = allCompleted([Promise.reject(failure), commit]);
  const observed = joined.catch((error) => {
    completed = true;
    return error;
  });
  await Promise.resolve();
  await Promise.resolve();
  expect(completed).toBe(false);
  finish();
  expect(await observed).toBe(failure);
});

it('preserves result ordering and normalizes non-Error rejections', async () => {
  await expect(allCompleted([Promise.resolve(2), 1])).resolves.toEqual([2, 1]);
  await expect(allCompleted([])).resolves.toEqual([]);
  // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors -- deliberately exercises a third-party non-Error rejection.
  await expect(allCompleted([Promise.reject(null)])).rejects.toThrow(
    'Concurrent operation failed',
  );
});
