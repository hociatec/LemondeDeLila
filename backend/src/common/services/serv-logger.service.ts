import { LoggerService, LogLevel } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';

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
      // Fallback (dev/CI) : si on ne peut pas écrire le fichier, on évite de faire planter le serveur.
      transports.push(new winston.transports.Console({ level }));
    }

    this.logger = winston.createLogger({
      level,
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
        winston.format.errors({ stack: true }),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          const ctx = meta?.context ? ` [${meta.context}]` : '';
          const rest = { ...meta };
          delete (rest as any).context;
          const metaStr =
            rest && Object.keys(rest).length > 0
              ? ` ${JSON.stringify(rest)}`
              : '';
          return `${timestamp} [${level}]${ctx} ${message}${metaStr}`;
        }),
      ),
      transports,
    });
  }

  log(message: any, context?: string) {
    this.logger.info(String(message), { context });
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(String(message), { context, trace });
  }

  warn(message: any, context?: string) {
    this.logger.warn(String(message), { context });
  }

  debug(message: any, context?: string) {
    this.logger.debug(String(message), { context });
  }

  verbose(message: any, context?: string) {
    this.logger.verbose(String(message), { context });
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
    (this.logger as any).level = level;
  }

  private resolveLevel(): string {
    const raw = (process.env.LOG_LEVEL || '').toLowerCase().trim();
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
    const env = (process.env.NODE_ENV || 'development').toLowerCase();
    return env === 'production' ? 'info' : 'debug';
  }

  private resolveFileTarget(): { enabled: boolean; logFilePath: string | null } {
    // Le backend tourne généralement depuis `backend/`, donc `../log/serv.log` pointe sur la racine du repo.
    const logDir = path.resolve(process.cwd(), '..', 'log');
    const logFilePath = path.join(logDir, 'serv.log');
    try {
      fs.mkdirSync(logDir, { recursive: true });
      return { enabled: true, logFilePath };
    } catch {
      return { enabled: false, logFilePath: null };
    }
  }
}

