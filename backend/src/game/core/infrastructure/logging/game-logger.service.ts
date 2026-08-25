import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as winston from 'winston';

import { GameError } from '../../domain/errors/game-errors';

export interface GameLogContext {
  gameType?: string;
  roomId?: number;
  playerId?: number;
  turnIndex?: number;
  action?: unknown;
  [key: string]: unknown;
}

type GameErrorLogData = {
  message: string;
  context: GameLogContext;
  error?: {
    name?: string;
    message?: string;
    severity?: string;
    context?: unknown;
    stack?: string;
  };
};

@Injectable()
export class GameLoggerService {
  private logger: winston.Logger;

  constructor(private readonly config: ConfigService) {
    const logLevel = this.config.get<string>('LOG_LEVEL', 'info');
    const enableFiles = this.config.get<boolean>('LOG_FILES_ENABLED', true);
    const logDir = enableFiles
      ? this.ensureDirectory(
          this.config.get<string>('LOG_DIR', 'logs') || 'logs',
        )
      : null;
    const transports: winston.transport[] = [
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize(),
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.printf(({ timestamp, level, message, ...meta }) => {
            const metaStr =
              Object.keys(meta).length > 0
                ? `\n${JSON.stringify(meta, null, 2)}`
                : '';
            return `${String(timestamp)} [${String(level)}]: ${String(message)}${metaStr}`;
          }),
        ),
      }),
    ];

    if (logDir) {
      transports.push(
        new winston.transports.File({
          filename: path.join(logDir, 'error.log'),
          level: 'error',
          maxsize: 5242880,
          maxFiles: 5,
        }),
        new winston.transports.File({
          filename: path.join(logDir, 'combined.log'),
          maxsize: 5242880,
          maxFiles: 5,
        }),
      );
    }

    this.logger = winston.createLogger({
      level: logLevel,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'game-engine' },
      transports,
    });
  }

  private ensureDirectory(dir: string): string | null {
    try {
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      console.warn(
        `[GameLogger] Impossible de creer le dossier ${dir}: ${detail}`,
      );
      return null;
    }
  }

  error(
    message: string,
    error?: Error | GameError,
    context?: GameLogContext,
  ): void {
    const logData: GameErrorLogData = {
      message,
      context: context || {},
    };

    if (error instanceof GameError) {
      logData.error = {
        name: error.name,
        message: error.message,
        severity: error.severity,
        context: error.context,
        stack: error.stack,
      };
    } else if (error instanceof Error) {
      logData.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    } else if (error) {
      logData.error = {
        message: String(error),
      };
    }

    this.logger.error(logData);
  }

  warn(message: string, context?: GameLogContext): void {
    this.logger.warn({
      message,
      context: context || {},
    });
  }

  info(message: string, context?: GameLogContext): void {
    this.logger.info({
      message,
      context: context || {},
    });
  }

  debug(message: string, context?: GameLogContext): void {
    this.logger.debug({
      message,
      context: context || {},
    });
  }

  logPlayerAction(
    action: {
      type: string;
      payload?: unknown;
    },
    context: GameLogContext,
  ): void {
    this.info('Player action', {
      ...context,
      action: {
        type: action.type,
        payload: action.payload,
        timestamp: new Date().toISOString(),
      },
    });
  }

  logStateChange(
    description: string,
    changes: Record<string, unknown>,
    context: GameLogContext,
  ): void {
    this.debug('Game state change', {
      ...context,
      description,
      changes,
    });
  }

  logValidationFailure(
    message: string,
    validationErrors: unknown[],
    context: GameLogContext,
  ): void {
    this.warn('Validation failure', {
      ...context,
      validationErrors,
      message,
    });
  }

  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context: GameLogContext,
  ): void {
    if (severity === 'critical' || severity === 'high') {
      this.error(`Security event: ${event}`, undefined, {
        ...context,
        securityEvent: event,
        severity,
      });
      return;
    }
    this.warn(`Security event: ${event}`, {
      ...context,
      securityEvent: event,
      severity,
    });
  }

  logPerformance(
    operation: string,
    durationMs: number,
    context: GameLogContext,
  ): void {
    this.debug('Performance metric', {
      ...context,
      operation,
      durationMs,
    });
  }

  getLogger(): winston.Logger {
    return this.logger;
  }
}
