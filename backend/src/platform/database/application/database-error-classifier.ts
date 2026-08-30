type DatabaseDriverError = {
  code?: unknown;
  errno?: unknown;
  driverError?: unknown;
};

export function isUniqueConstraintViolation(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const candidate = error as DatabaseDriverError;
  if (candidate.code === 'ER_DUP_ENTRY' || candidate.errno === 1062)
    return true;
  return candidate.driverError !== error
    ? isUniqueConstraintViolation(candidate.driverError)
    : false;
}

export async function mapUniqueConstraintViolation<T>(
  operation: () => Promise<T>,
  conflict: () => Error,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (isUniqueConstraintViolation(error)) throw conflict();
    throw error;
  }
}
