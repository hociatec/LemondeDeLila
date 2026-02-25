"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameContentLoaderService", {
    enumerable: true,
    get: function() {
        return GameContentLoaderService;
    }
});
const _common = require("@nestjs/common");
const _nodefs = /*#__PURE__*/ _interop_require_wildcard(require("node:fs"));
const _nodepath = /*#__PURE__*/ _interop_require_wildcard(require("node:path"));
const _mojibake = require("../../../common/utils/mojibake");
const _gameerrors = require("../../../common/errors/game-errors");
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let GameContentLoaderService = class GameContentLoaderService {
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
   */ loadContent(config) {
        const cacheKey = this.buildCacheKey(config);
        const filePath = this.buildPath(config);
        const currentMtimeMs = this.tryGetFileMtimeMs(filePath);
        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (this.isCacheValid(cached, config.ttl, currentMtimeMs)) {
                return cached.value;
            }
        }
        try {
            // Load JSON with encoding fallback
            const raw = (0, _mojibake.readJsonFileWithFallback)(filePath);
            // Validate
            this.validateContent(raw, config.validators);
            // Transform if transformer provided
            const value = config.transformer ? config.transformer(raw) : raw;
            // Cache the result
            this.cache.set(cacheKey, {
                value,
                loadedAt: Date.now(),
                fileMtimeMs: currentMtimeMs
            });
            // Log if logger provided
            if (config.logger) {
                config.logger('content.loaded', {
                    gameType: config.gameType,
                    filename: config.filename,
                    path: filePath
                });
            }
            return value;
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
   */ isCached(gameType, filename) {
        const cacheKey = `${gameType}:${filename}`;
        return this.cache.has(cacheKey);
    }
    /**
   * Build the full path to a content file.
   *
   * @param config - Content load configuration
   * @returns Absolute path to the content file
   */ buildPath(config) {
        const contentDir = config.contentDir ?? 'model/content';
        return _nodepath.join(config.baseDir, '..', contentDir, config.filename);
    }
    /**
   * Build a unique cache key for a content file.
   *
   * @param config - Content load configuration
   * @returns Cache key string
   */ buildCacheKey(config) {
        return `${config.gameType}:${config.filename}`;
    }
    /**
   * Check if cached content is still valid based on TTL.
   *
   * @param cached - Cached content entry
   * @param ttl - Time-to-live in milliseconds (undefined = cache forever)
   * @returns True if cache is still valid
   */ isCacheValid(cached, ttl, currentMtimeMs) {
        // If the underlying file changed (e.g. deployment updated JSON assets),
        // invalidate cache even when ttl is not set.
        if (cached.fileMtimeMs !== currentMtimeMs) {
            return false;
        }
        if (!ttl) return true; // No TTL means cache forever
        return Date.now() - cached.loadedAt < ttl;
    }
    tryGetFileMtimeMs(filePath) {
        try {
            return _nodefs.statSync(filePath).mtimeMs;
        } catch  {
            return null;
        }
    }
    /**
   * Run all validators on the loaded data.
   *
   * @param data - Data to validate
   * @param validators - Array of validator functions
   * @throws Error if any validator fails
   */ validateContent(data, validators) {
        if (!validators) return;
        for (const validator of validators){
            validator(data);
        }
    }
    /**
   * Create a detailed error message for content loading failures.
   *
   * @param config - Content load configuration
   * @param error - Original error
   * @returns Error with detailed message
   */ createError(config, error) {
        // If already a GameContentError, return it as-is
        if (error instanceof _gameerrors.GameContentError) {
            return error;
        }
        const message = this.normalizeErrorMessage(error);
        return new _gameerrors.GameContentError(`Failed to load ${config.gameType} content from ${config.filename}: ${message}`, {
            gameType: config.gameType,
            filename: config.filename,
            originalError: this.normalizeErrorMessage(error)
        });
    }
    static toRecord(value) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        return {};
    }
    static stringifyField(value) {
        if (typeof value === 'string') return value;
        if (typeof value === 'number' || typeof value === 'boolean') return String(value);
        if (Array.isArray(value)) return JSON.stringify(value);
        if (value && typeof value === 'object') return JSON.stringify(value);
        if (value === null || value === undefined) return '';
        if (typeof value === 'symbol') return value.toString();
        if (typeof value === 'function') return value.name || 'function';
        return '';
    }
    normalizeErrorMessage(error) {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        if (error === null || error === undefined) return 'Unknown error';
        try {
            return JSON.stringify(error);
        } catch  {
            return 'Unknown error';
        }
    }
    constructor(){
        this.cache = new Map();
        /**
   * Standard validators for common content validation patterns.
   * Use these in your ContentLoadConfig validators array.
   */ this.validators = {
            version: (expectedVersion)=>(data)=>{
                    const record = GameContentLoaderService.toRecord(data);
                    const versionValue = record['version'];
                    if (versionValue !== expectedVersion) {
                        throw new _gameerrors.GameContentError(`Invalid version. Expected ${expectedVersion}`, {
                            expectedVersion,
                            actualVersion: typeof versionValue === 'number' ? versionValue : GameContentLoaderService.stringifyField(versionValue)
                        });
                    }
                },
            arrayField: (field, minLength = 0)=>(data)=>{
                    const record = GameContentLoaderService.toRecord(data);
                    const fieldValue = record[field];
                    if (!Array.isArray(fieldValue)) {
                        throw new _gameerrors.GameContentError(`Missing or invalid array field: ${field}`, {
                            field,
                            actualType: typeof fieldValue
                        });
                    }
                    if (minLength > 0 && fieldValue.length < minLength) {
                        throw new _gameerrors.GameContentError(`${field} must have at least ${minLength} item(s)`, {
                            field,
                            minLength,
                            actualLength: fieldValue.length
                        });
                    }
                },
            requiredFields: (...fields)=>(data)=>{
                    const record = GameContentLoaderService.toRecord(data);
                    const missing = fields.filter((f)=>!(f in record));
                    if (missing.length > 0) {
                        throw new _gameerrors.GameContentError(`Missing required fields: ${missing.join(', ')}`, {
                            missingFields: missing,
                            requiredFields: fields
                        });
                    }
                },
            typeCheck: (field, expectedType)=>(data)=>{
                    const record = GameContentLoaderService.toRecord(data);
                    const fieldValue = record[field];
                    if (typeof fieldValue !== expectedType) {
                        throw new _gameerrors.GameContentError(`Field ${field} must be of type ${expectedType}, got ${typeof fieldValue}`, {
                            field,
                            expectedType,
                            actualType: typeof fieldValue
                        });
                    }
                },
            nonEmptyString: (field)=>(data)=>{
                    const record = GameContentLoaderService.toRecord(data);
                    const fieldValue = record[field];
                    if (typeof fieldValue !== 'string' || fieldValue.trim() === '') {
                        throw new _gameerrors.GameContentError(`Field ${field} must be a non-empty string`, {
                            field,
                            actualType: typeof fieldValue,
                            actualValue: fieldValue
                        });
                    }
                },
            positiveNumber: (field)=>(data)=>{
                    const record = GameContentLoaderService.toRecord(data);
                    const fieldValue = record[field];
                    if (typeof fieldValue !== 'number' || fieldValue <= 0) {
                        throw new _gameerrors.GameContentError(`Field ${field} must be a positive number`, {
                            field,
                            actualType: typeof fieldValue,
                            actualValue: fieldValue
                        });
                    }
                }
        };
    }
};
GameContentLoaderService = _ts_decorate([
    (0, _common.Injectable)()
], GameContentLoaderService);
