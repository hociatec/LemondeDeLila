import { environmentValidationSchema } from './environment-validation';

/** Only schema-owned names and error codes may reach startup logs. */
export function validateEnvironment(
  input: Record<string, unknown>,
): Record<string, unknown> {
  if (
    !input ||
    typeof input !== 'object' ||
    Array.isArray(input) ||
    Object.keys(input).length > 512
  ) {
    throw new Error('Configuration invalide');
  }
  const result = environmentValidationSchema.validate(input, {
    abortEarly: false,
    allowUnknown: true,
  });
  if (result.error) {
    const schemaKeys: unknown = environmentValidationSchema.describe().keys;
    const knownKeys = new Set(
      Object.keys(
        schemaKeys && typeof schemaKeys === 'object' ? schemaKeys : {},
      ),
    );
    const problems = result.error.details.slice(0, 512).map((detail) => {
      const key = detail.path[0];
      const label =
        typeof key === 'string' && knownKeys.has(key) ? key : 'configuration';
      return `${label} (${detail.type})`;
    });
    // Never attach Joi's original error: its context retains supplied values.
    throw new Error(
      `Configuration invalide : ${[...new Set(problems)].slice(0, 512).join(', ')}`,
    );
  }
  const value: unknown = result.value;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Configuration invalide');
  }
  return value as Record<string, unknown>;
}
