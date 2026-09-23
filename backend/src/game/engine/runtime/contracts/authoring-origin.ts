/** Local compilation metadata; preserves the original error type and public API. */
const origins = new WeakMap<Error, string>();

export function withAuthoringPath<TError extends Error>(
  error: TError,
  path: string,
): TError {
  origins.set(error, path);
  return error;
}

export function authoringPathOf(error: unknown): string | undefined {
  return error instanceof Error ? origins.get(error) : undefined;
}

export function atAuthoringPath<T>(path: string, operation: () => T): T {
  try {
    return operation();
  } catch (error) {
    if (error instanceof Error) {
      const nested = origins.get(error);
      origins.set(
        error,
        path + (nested ? `${nested.startsWith('[') ? '' : '.'}${nested}` : ''),
      );
    }
    throw error;
  }
}
