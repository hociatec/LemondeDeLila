const MAX_CONCURRENT_OPERATIONS = 64;

/** Wait for every branch, then preserve the first rejection observed. */
export async function allCompleted<T>(
  operations: Iterable<T | PromiseLike<T>>,
): Promise<Awaited<T>[]> {
  let firstError: Error | undefined;
  const values: Awaited<T>[] = [];
  let batch: Promise<Awaited<T>>[] = [];

  const consumeBatch = async (): Promise<void> => {
    const results = await Promise.allSettled(batch);
    for (const result of results) {
      if (result.status === 'fulfilled') {
        values.push(result.value);
      }
    }
    batch = [];
  };

  for (const operation of operations) {
    batch.push(
      Promise.resolve(operation).catch((reason: unknown) => {
        const error =
          reason instanceof Error
            ? reason
            : new Error('Concurrent operation failed', { cause: reason });
        firstError ??= error;
        throw error;
      }),
    );
    if (batch.length >= MAX_CONCURRENT_OPERATIONS) {
      await consumeBatch();
    }
  }

  if (batch.length > 0) {
    await consumeBatch();
  }

  if (firstError) throw firstError;
  return values;
}
