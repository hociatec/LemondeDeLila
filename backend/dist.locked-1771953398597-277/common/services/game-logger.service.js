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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameLoggerService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const winston = __importStar(require("winston"));
const game_errors_1 = require("../errors/game-errors");
let GameLoggerService = class GameLoggerService {
    config;
    logger;
    constructor(config) {
        this.config = config;
        const logLevel = this.config.get('LOG_LEVEL', 'info');
        const enableFiles = this.config.get('LOG_FILES_ENABLED', true);
        const logDir = enableFiles
            ? this.ensureDirectory(this.config.get('LOG_DIR', 'logs') || 'logs')
            : null;
        const transports = [
            new winston.transports.Console({
                format: winston.format.combine(winston.format.colorize(), winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), winston.format.printf(({ timestamp, level, message, ...meta }) => {
                    const metaStr = Object.keys(meta).length > 0
                        ? `\n${JSON.stringify(meta, null, 2)}`
                        : '';
                    return `${String(timestamp)} [${String(level)}]: ${String(message)}${metaStr}`;
                })),
            }),
        ];
        if (logDir) {
            transports.push(new winston.transports.File({
                filename: path.join(logDir, 'error.log'),
                level: 'error',
                maxsize: 5242880,
                maxFiles: 5,
            }), new winston.transports.File({
                filename: path.join(logDir, 'combined.log'),
                maxsize: 5242880,
                maxFiles: 5,
            }));
        }
        this.logger = winston.createLogger({
            level: logLevel,
            format: winston.format.combine(winston.format.timestamp(), winston.format.errors({ stack: true }), winston.format.json()),
            defaultMeta: { service: 'game-engine' },
            transports,
        });
    }
    ensureDirectory(dir) {
        try {
            fs.mkdirSync(dir, { recursive: true });
            return dir;
        }
        catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            console.warn(`[GameLogger] Impossible de creer le dossier ${dir}: ${detail}`);
            return null;
        }
    }
    error(message, error, context) {
        const logData = {
            message,
            context: context || {},
        };
        if (error instanceof game_errors_1.GameError) {
            logData.error = {
                name: error.name,
                message: error.message,
                severity: error.severity,
                context: error.context,
                stack: error.stack,
            };
        }
        else if (error instanceof Error) {
            logData.error = {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        }
        else if (error) {
            logData.error = {
                message: String(error),
            };
        }
        this.logger.error(logData);
    }
    warn(message, context) {
        this.logger.warn({
            message,
            context: context || {},
        });
    }
    info(message, context) {
        this.logger.info({
            message,
            context: context || {},
        });
    }
    debug(message, context) {
        this.logger.debug({
            message,
            context: context || {},
        });
    }
    logPlayerAction(action, context) {
        this.info('Player action', {
            ...context,
            action: {
                type: action.type,
                payload: action.payload,
                timestamp: new Date().toISOString(),
            },
        });
    }
    logStateChange(description, changes, context) {
        this.debug('Game state change', {
            ...context,
            description,
            changes,
        });
    }
    logValidationFailure(message, validationErrors, context) {
        this.warn('Validation failure', {
            ...context,
            validationErrors,
            message,
        });
    }
    logSecurityEvent(event, severity, context) {
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
    logPerformance(operation, durationMs, context) {
        this.debug('Performance metric', {
            ...context,
            operation,
            durationMs,
        });
    }
    getLogger() {
        return this.logger;
    }
};
exports.GameLoggerService = GameLoggerService;
exports.GameLoggerService = GameLoggerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], GameLoggerService);
//# sourceMappingURL=game-logger.service.js.map