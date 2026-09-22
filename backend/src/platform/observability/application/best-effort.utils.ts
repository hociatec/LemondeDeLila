import { getErrorMessage } from '../../../shared/utils/public-api';
import { sanitizeLogText } from './log-sanitizer';

type WarningLogger = { warn(message: string): unknown };

export async function bestEffort<T>(
  operation: Promise<T>,
  label: string,
  logger?: WarningLogger,
): Promise<T | undefined> {
  try {
    return await operation;
  } catch (error) {
    const message = sanitizeLogText(`${label}: ${getErrorMessage(error)}`);
    if (logger) logger.warn(message);
    else process.emitWarning(message, { code: 'BEST_EFFORT_OPERATION_FAILED' });
    return undefined;
  }
}
