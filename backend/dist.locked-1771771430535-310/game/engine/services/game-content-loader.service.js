"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var GameContentLoaderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameContentLoaderService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("node:fs"));
const path = __importStar(require("node:path"));
const mojibake_1 = require("../../../common/utils/mojibake");
const game_errors_1 = require("../../../common/errors/game-errors");
let GameContentLoaderService = GameContentLoaderService_1 = class GameContentLoaderService {
    cache = new Map();
    validators = {
        version: (expectedVersion) => (data) => {
            const record = GameContentLoaderService_1.toRecord(data);
            const versionValue = record['version'];
            if (versionValue !== expectedVersion) {
                throw new game_errors_1.GameContentError(`Invalid version. Expected ${expectedVersion}`, {
                    expectedVersion,
                    actualVersion: typeof versionValue === 'number'
                        ? versionValue
                        : GameContentLoaderService_1.stringifyField(versionValue),
                });
            }
        },
        arrayField: (field, minLength = 0) => (data) => {
            const record = GameContentLoaderService_1.toRecord(data);
            const fieldValue = record[field];
            if (!Array.isArray(fieldValue)) {
                throw new game_errors_1.GameContentError(`Missing or invalid array field: ${field}`, {
                    field,
                    actualType: typeof fieldValue,
                });
            }
            if (minLength > 0 && fieldValue.length < minLength) {
                throw new game_errors_1.GameContentError(`${field} must have at least ${minLength} item(s)`, {
                    field,
                    minLength,
                    actualLength: fieldValue.length,
                });
            }
        },
        requiredFields: (...fields) => (data) => {
            const record = GameContentLoaderService_1.toRecord(data);
            const missing = fields.filter((f) => !(f in record));
            if (missing.length > 0) {
                throw new game_errors_1.GameContentError(`Missing required fields: ${missing.join(', ')}`, {
                    missingFields: missing,
                    requiredFields: fields,
                });
            }
        },
        typeCheck: (field, expectedType) => (data) => {
            const record = GameContentLoaderService_1.toRecord(data);
            const fieldValue = record[field];
            if (typeof fieldValue !== expectedType) {
                throw new game_errors_1.GameContentError(`Field ${field} must be of type ${expectedType}, got ${typeof fieldValue}`, {
                    field,
                    expectedType,
                    actualType: typeof fieldValue,
                });
            }
        },
        nonEmptyString: (field) => (data) => {
            const record = GameContentLoaderService_1.toRecord(data);
            const fieldValue = record[field];
            if (typeof fieldValue !== 'string' || fieldValue.trim() === '') {
                throw new game_errors_1.GameContentError(`Field ${field} must be a non-empty string`, {
                    field,
                    actualType: typeof fieldValue,
                    actualValue: fieldValue,
                });
            }
        },
        positiveNumber: (field) => (data) => {
            const record = GameContentLoaderService_1.toRecord(data);
            const fieldValue = record[field];
            if (typeof fieldValue !== 'number' || fieldValue <= 0) {
                throw new game_errors_1.GameContentError(`Field ${field} must be a positive number`, {
                    field,
                    actualType: typeof fieldValue,
                    actualValue: fieldValue,
                });
            }
        },
    };
    loadContent(config) {
        const cacheKey = this.buildCacheKey(config);
        const filePath = this.buildPath(config);
        const currentMtimeMs = this.tryGetFileMtimeMs(filePath);
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (this.isCacheValid(cached, config.ttl, currentMtimeMs)) {
                return cached.value;
            }
        }
        try {
            const raw = (0, mojibake_1.readJsonFileWithFallback)(filePath);
            this.validateContent(raw, config.validators);
            const value = config.transformer ? config.transformer(raw) : raw;
            this.cache.set(cacheKey, {
                value,
                loadedAt: Date.now(),
                fileMtimeMs: currentMtimeMs,
            });
            if (config.logger) {
                config.logger('content.loaded', {
                    gameType: config.gameType,
                    filename: config.filename,
                    path: filePath,
                });
            }
            return value;
        }
        catch (error) {
            throw this.createError(config, error);
        }
    }
    isCached(gameType, filename) {
        const cacheKey = `${gameType}:${filename}`;
        return this.cache.has(cacheKey);
    }
    buildPath(config) {
        const contentDir = config.contentDir ?? 'model/content';
        return path.join(config.baseDir, '..', contentDir, config.filename);
    }
    buildCacheKey(config) {
        return `${config.gameType}:${config.filename}`;
    }
    isCacheValid(cached, ttl, currentMtimeMs) {
        if (cached.fileMtimeMs !== currentMtimeMs) {
            return false;
        }
        if (!ttl)
            return true;
        return Date.now() - cached.loadedAt < ttl;
    }
    tryGetFileMtimeMs(filePath) {
        try {
            return fs.statSync(filePath).mtimeMs;
        }
        catch {
            return null;
        }
    }
    validateContent(data, validators) {
        if (!validators)
            return;
        for (const validator of validators) {
            validator(data);
        }
    }
    createError(config, error) {
        if (error instanceof game_errors_1.GameContentError) {
            return error;
        }
        const message = this.normalizeErrorMessage(error);
        return new game_errors_1.GameContentError(`Failed to load ${config.gameType} content from ${config.filename}: ${message}`, {
            gameType: config.gameType,
            filename: config.filename,
            originalError: this.normalizeErrorMessage(error),
        });
    }
    static toRecord(value) {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        return {};
    }
    static stringifyField(value) {
        if (typeof value === 'string')
            return value;
        if (typeof value === 'number' || typeof value === 'boolean')
            return String(value);
        if (Array.isArray(value))
            return JSON.stringify(value);
        if (value && typeof value === 'object')
            return JSON.stringify(value);
        if (value === null || value === undefined)
            return '';
        if (typeof value === 'symbol')
            return value.toString();
        if (typeof value === 'function')
            return value.name || 'function';
        return '';
    }
    normalizeErrorMessage(error) {
        if (error instanceof Error)
            return error.message;
        if (typeof error === 'string')
            return error;
        if (error === null || error === undefined)
            return 'Unknown error';
        try {
            return JSON.stringify(error);
        }
        catch {
            return 'Unknown error';
        }
    }
};
exports.GameContentLoaderService = GameContentLoaderService;
exports.GameContentLoaderService = GameContentLoaderService = GameContentLoaderService_1 = __decorate([
    (0, common_1.Injectable)()
], GameContentLoaderService);
//# sourceMappingURL=game-content-loader.service.js.map