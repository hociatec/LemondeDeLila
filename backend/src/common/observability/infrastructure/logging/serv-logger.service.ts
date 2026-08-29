import { LoggerService, LogLevel } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';
import {
  readEnvironment,
  readEnvironmentBoolean,
} from '../../../../config/public-api';
import { sanitizeLogText } from '../../application/log-sanitizer';

export class ServLoggerService implements LoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    const level = this.resolveLevel();
    const { logFilePath, enabled } = this.resolveFileTarget();

    const transports: winston.transport[] = [];
    if (enabled && logFilePath) {
      transports.push(
        new winston.transports.File({
          filename: logFilePath,
          level,
          maxsize: 5 * 1024 * 1024,
          maxFiles: 5,
        }),
      );
    } else {
      transports.push(new winston.transports.Console({ level }));
    }

    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const context =
            typeof meta.context === 'string' ? meta.context.trim() : '';
          const ctx = context ? ` [${context}]` : '';
          const rest = { ...meta };
          delete rest.context;
          const metaStr =
            rest && Object.keys(rest).length > 0
              ? ` ${JSON.stringify(rest)}`
              : '';
          return `${String(timestamp)} [${String(level)}]${ctx} ${String(message)}${metaStr}`;
        }),
      ),
      transports,
    });
  }

  log(message: unknown, context?: string) {
    this.logger.info(sanitizeLogText(String(message)), { context });
  }

  error(message: unknown, trace?: string, context?: string) {
    this.logger.error(sanitizeLogText(String(message)), {
      context,
      trace: trace ? sanitizeLogText(trace) : trace,
    });
  }

  warn(message: unknown, context?: string) {
    this.logger.warn(sanitizeLogText(String(message)), { context });
  }

  debug(message: unknown, context?: string) {
    this.logger.debug(sanitizeLogText(String(message)), { context });
  }

  verbose(message: unknown, context?: string) {
    this.logger.verbose(sanitizeLogText(String(message)), { context });
  }

  setLogLevels(levels: LogLevel[]) {
    const order: Record<LogLevel, number> = {
      error: 0,
      warn: 1,
      log: 2,
      debug: 3,
      verbose: 4,
      fatal: 0,
    };
    const max = Math.max(...levels.map((l) => order[l] ?? 2));
    const mapped: Record<number, string> = {
      0: 'error',
      1: 'warn',
      2: 'info',
      3: 'debug',
      4: 'verbose',
    };
    const level = mapped[max] ?? 'info';
    this.logger.level = level;
  }

  private resolveLevel(): string {
    const raw = readEnvironment('LOG_LEVEL').toLowerCase().trim();
    const allowed = new Set([
      'error',
      'warn',
      'info',
      'http',
      'verbose',
      'debug',
      'silly',
    ]);
    if (allowed.has(raw)) return raw;
    const env = readEnvironment('NODE_ENV', 'development').toLowerCase();
    return env === 'production' ? 'info' : 'debug';
  }

  private resolveFileTarget(): {
    enabled: boolean;
    logFilePath: string | null;
  } {
    const enabled = readEnvironmentBoolean('LOG_FILES_ENABLED', true);
    if (!enabled) {
      return { enabled: false, logFilePath: null };
    }

    const configuredDir = readEnvironment('LOG_DIR').trim();
    const logDir = configuredDir
      ? path.isAbsolute(configuredDir)
        ? configuredDir
        : path.resolve(process.cwd(), configuredDir)
      : path.resolve(process.cwd(), 'logs');

    const logFilePath = path.join(logDir, 'serv.log');
    try {
      fs.mkdirSync(logDir, { recursive: true });
      return { enabled: true, logFilePath };
    } catch {
      return { enabled: false, logFilePath: null };
    }
  }
}
