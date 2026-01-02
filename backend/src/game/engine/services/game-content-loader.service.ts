import { Injectable } from '@nestjs/common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { readJsonFileWithFallback } from '../../../common/utils/mojibake';
import { GameContentError } from '../../../common/errors/game-errors';

/**
 * Configuration for loading game content
 */
export interface ContentLoadConfig<T = any> {
  /** Game identifier (e.g., 'dame-nature') */
  gameType: string;
  /** Base directory (usually __dirname from the calling service) */
  baseDir: string;
  /** Filename of the JSON file (e.g., 'families.json') */
  filename: string;
  /** Subdirectory containing content files (defaults to 'model/content') */
  contentDir?: string;
  /** Validators to run on the loaded data */
  validators?: Array<(data: any) => void>;
  /** Optional transformer to convert raw JSON to desired type */
  transformer?: (data: any) => T;
  /** Cache time-to-live in milliseconds (undefined = cache forever) */
  ttl?: number;
  /** Optional logger function */
  logger?: (event: string, data: any) => void;
}

/**
 * Cached content entry
 */
interface CachedContent {
  value: any;
  loadedAt: number;
  fileMtimeMs: number | null;
}

/**
 * Validator factory functions for common validation patterns
 */
export interface ContentValidators {
  /** Validates the version field */
  version: (expectedVersion: number) => (data: any) => void;
  /** Validates that a field is an array with optional minimum length */
  arrayField: (field: string, minLength?: number) => (data: any) => void;
  /** Validates that required fields exist */
  requiredFields: (...fields: string[]) => (data: any) => void;
  /** Validates the type of a field */
  typeCheck: (field: string, expectedType: string) => (data: any) => void;
  /** Validates that a field is a non-empty string */
  nonEmptyString: (field: string) => (data: any) => void;
  /** Validates that a field is a positive number */
  positiveNumber: (field: string) => (data: any) => void;
}

/**
 * Generic service for loading and caching game content from JSON files.
 * Provides:
 * - Automatic caching with optional TTL
 * - Standard validators for common patterns
 * - Encoding fallback handling via mojibake utility
 * - Consistent error messages
 * - Optional transformation and logging
 */
@Injectable()
export class GameContentLoaderService {
  private readonly cache = new Map<string, CachedContent>();

  /**
   * Standard validators for common content validation patterns.
   * Use these in your ContentLoadConfig validators array.
   */
  readonly validators: ContentValidators = {
    version: (expectedVersion: number) => (data: any) => {
      if (!data || data.version !== expectedVersion) {
        throw new GameContentError(
          `Invalid version. Expected ${expectedVersion}`,
          {
            expectedVersion,
            actualVersion: data?.version,
          },
        );
      }
    },

    arrayField:
      (field: string, minLength = 0) =>
      (data: any) => {
        if (!Array.isArray(data[field])) {
          throw new GameContentError(
            `Missing or invalid array field: ${field}`,
            {
              field,
              actualType: typeof data[field],
            },
          );
        }
        if (minLength > 0 && data[field].length < minLength) {
          throw new GameContentError(
            `${field} must have at least ${minLength} item(s)`,
            {
              field,
              minLength,
              actualLength: data[field].length,
            },
          );
        }
      },

    requiredFields:
      (...fields: string[]) =>
      (data: any) => {
        const missing = fields.filter((f) => !(f in data));
        if (missing.length > 0) {
          throw new GameContentError(
            `Missing required fields: ${missing.join(', ')}`,
            {
              missingFields: missing,
              requiredFields: fields,
            },
          );
        }
      },

    typeCheck: (field: string, expectedType: string) => (data: any) => {
      if (typeof data[field] !== expectedType) {
        throw new GameContentError(
          `Field ${field} must be of type ${expectedType}, got ${typeof data[field]}`,
          {
            field,
            expectedType,
            actualType: typeof data[field],
          },
        );
      }
    },

    nonEmptyString: (field: string) => (data: any) => {
      if (typeof data[field] !== 'string' || data[field].trim() === '') {
        throw new GameContentError(
          `Field ${field} must be a non-empty string`,
          {
            field,
            actualType: typeof data[field],
            actualValue: data[field],
          },
        );
      }
    },

    positiveNumber: (field: string) => (data: any) => {
      if (typeof data[field] !== 'number' || data[field] <= 0) {
        throw new GameContentError(`Field ${field} must be a positive number`, {
          field,
          actualType: typeof data[field],
          actualValue: data[field],
        });
      }
    },
  };

  /**
   * Load and cache JSON content with validation.
   *
   * @param config - Configuration for loading the content
   * @returns The loaded and validated content
   * @throws Error if loading or validation fails
   *
   * @example
   * const families = await loader.loadContent<FamiliesJson>({
   *   gameType: 'dame-nature',
   *   baseDir: __dirname,
   *   filename: 'families.json',
   *   validators: [
   *     loader.validators.version(1),
   *     loader.validators.arrayField('families', 1),
   *   ],
   * });
   */
  loadContent<T = any>(config: ContentLoadConfig<T>): T {
    const cacheKey = this.buildCacheKey(config);
    const filePath = this.buildPath(config);
    const currentMtimeMs = this.tryGetFileMtimeMs(filePath);

    // Check cache
    if (this.cache.has(cacheKey)) {
      const cached = this.cache.get(cacheKey)!;
      if (this.isCacheValid(cached, config.ttl, currentMtimeMs)) {
        return cached.value as T;
      }
    }

    try {
      // Load JSON with encoding fallback
      const raw = readJsonFileWithFallback<any>(filePath);

      // Validate
      this.validateContent(raw, config.validators);

      // Transform if transformer provided
      const value = config.transformer ? config.transformer(raw) : raw;

      // Cache the result
      this.cache.set(cacheKey, {
        value,
        loadedAt: Date.now(),
        fileMtimeMs: currentMtimeMs,
      });

      // Log if logger provided
      if (config.logger) {
        config.logger('content.loaded', {
          gameType: config.gameType,
          filename: config.filename,
          path: filePath,
        });
      }

      return value as T;
    } catch (error) {
      throw this.createError(config, error);
    }
  }

  /**
   * Check if a specific content file is cached.
   *
   * @param gameType - Game identifier
   * @param filename - Filename to check
   * @returns True if the content is cached and valid
   */
  isCached(gameType: string, filename: string): boolean {
    const cacheKey = `${gameType}:${filename}`;
    return this.cache.has(cacheKey);
  }

  /**
   * Build the full path to a content file.
   *
   * @param config - Content load configuration
   * @returns Absolute path to the content file
   */
  private buildPath(config: ContentLoadConfig): string {
    const contentDir = config.contentDir ?? 'model/content';
    return path.join(config.baseDir, '..', contentDir, config.filename);
  }

  /**
   * Build a unique cache key for a content file.
   *
   * @param config - Content load configuration
   * @returns Cache key string
   */
  private buildCacheKey(config: ContentLoadConfig): string {
    return `${config.gameType}:${config.filename}`;
  }

  /**
   * Check if cached content is still valid based on TTL.
   *
   * @param cached - Cached content entry
   * @param ttl - Time-to-live in milliseconds (undefined = cache forever)
   * @returns True if cache is still valid
   */
  private isCacheValid(
    cached: CachedContent,
    ttl: number | undefined,
    currentMtimeMs: number | null,
  ): boolean {
    // If the underlying file changed (e.g. deployment updated JSON assets),
    // invalidate cache even when ttl is not set.
    if (cached.fileMtimeMs !== currentMtimeMs) {
      return false;
    }

    if (!ttl) return true; // No TTL means cache forever
    return Date.now() - cached.loadedAt < ttl;
  }

  private tryGetFileMtimeMs(filePath: string): number | null {
    try {
      return fs.statSync(filePath).mtimeMs;
    } catch {
      return null;
    }
  }

  /**
   * Run all validators on the loaded data.
   *
   * @param data - Data to validate
   * @param validators - Array of validator functions
   * @throws Error if any validator fails
   */
  private validateContent(
    data: any,
    validators?: Array<(data: any) => void>,
  ): void {
    if (!validators) return;
    for (const validator of validators) {
      validator(data);
    }
  }

  /**
   * Create a detailed error message for content loading failures.
   *
   * @param config - Content load configuration
   * @param error - Original error
   * @returns Error with detailed message
   */
  private createError(config: ContentLoadConfig, error: any): GameContentError {
    // If already a GameContentError, return it as-is
    if (error instanceof GameContentError) {
      return error;
    }

    const message =
      error instanceof Error ? error.message : String(error ?? 'Unknown error');
    return new GameContentError(
      `Failed to load ${config.gameType} content from ${config.filename}: ${message}`,
      {
        gameType: config.gameType,
        filename: config.filename,
        originalError: error instanceof Error ? error.message : error,
      },
    );
  }
}
