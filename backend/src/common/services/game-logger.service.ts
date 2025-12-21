import { Injectable } from '@nestjs/common';
import * as winston from 'winston';
import { GameError } from '../errors/game-errors';

/**
 * Context for game-related logs
 */
export interface GameLogContext {
  gameType?: string;
  roomId?: number;
  playerId?: number;
  turnIndex?: number;
  action?: unknown;
  [key: string]: unknown;
}

/**
 * Service for structured logging of game events and errors
 */
@Injectable()
export class GameLoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
      ),
      defaultMeta: { service: 'game-engine' },
      transports: [
        // Console transport for development
        new winston.transports.Console({
          format: winston.format.combine(
            winston.format.colorize(),
            winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            winston.format.printf(({ timestamp, level, message, ...meta }) => {
              const metaStr = Object.keys(meta).length
                ? `\n${JSON.stringify(meta, null, 2)}`
                : '';
              return `${timestamp} [${level}]: ${message}${metaStr}`;
            }),
          ),
        }),
        // File transport for errors
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
        // File transport for all logs
        new winston.transports.File({
          filename: 'logs/combined.log',
          maxsize: 5242880, // 5MB
          maxFiles: 5,
        }),
      ],
    });
  }

  /**
   * Log an error with full context
   */
  error(message: string, error?: Error | GameError, context?: GameLogContext): void {
    const logData: any = {
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
      logData.error = error;
    }

    this.logger.error(logData);
  }

  /**
   * Log a warning
   */
  warn(message: string, context?: GameLogContext): void {
    this.logger.warn({
      message,
      context: context || {},
    });
  }

  /**
   * Log an info message
   */
  info(message: string, context?: GameLogContext): void {
    this.logger.info({
      message,
      context: context || {},
    });
  }

  /**
   * Log a debug message
   */
  debug(message: string, context?: GameLogContext): void {
    this.logger.debug({
      message,
      context: context || {},
    });
  }

  /**
   * Log a player action for audit trail
   */
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

  /**
   * Log game state change
   */
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

  /**
   * Log validation failure
   */
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

  /**
   * Log security event (suspicious activity, anti-cheat, etc.)
   */
  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context: GameLogContext,
  ): void {
    const logFn = severity === 'critical' || severity === 'high'
      ? this.error.bind(this)
      : this.warn.bind(this);

    logFn(`Security event: ${event}`, undefined, {
      ...context,
      securityEvent: event,
      severity,
    });
  }

  /**
   * Log performance metric
   */
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

  /**
   * Get the underlying Winston logger for advanced usage
   */
  getLogger(): winston.Logger {
    return this.logger;
  }
}
