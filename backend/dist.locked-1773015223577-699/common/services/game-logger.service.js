"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameLoggerService", {
    enumerable: true,
    get: function() {
        return GameLoggerService;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
const _winston = /*#__PURE__*/ _interop_require_wildcard(require("winston"));
const _gameerrors = require("../errors/game-errors");
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
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GameLoggerService = class GameLoggerService {
    ensureDirectory(dir) {
        try {
            _fs.mkdirSync(dir, {
                recursive: true
            });
            return dir;
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error);
            console.warn(`[GameLogger] Impossible de creer le dossier ${dir}: ${detail}`);
            return null;
        }
    }
    /**
   * Log an error with full context
   */ error(message, error, context) {
        const logData = {
            message,
            context: context || {}
        };
        if (error instanceof _gameerrors.GameError) {
            logData.error = {
                name: error.name,
                message: error.message,
                severity: error.severity,
                context: error.context,
                stack: error.stack
            };
        } else if (error instanceof Error) {
            logData.error = {
                name: error.name,
                message: error.message,
                stack: error.stack
            };
        } else if (error) {
            logData.error = {
                message: String(error)
            };
        }
        this.logger.error(logData);
    }
    /**
   * Log a warning
   */ warn(message, context) {
        this.logger.warn({
            message,
            context: context || {}
        });
    }
    /**
   * Log an info message
   */ info(message, context) {
        this.logger.info({
            message,
            context: context || {}
        });
    }
    /**
   * Log a debug message
   */ debug(message, context) {
        this.logger.debug({
            message,
            context: context || {}
        });
    }
    /**
   * Log a player action for audit trail
   */ logPlayerAction(action, context) {
        this.info('Player action', {
            ...context,
            action: {
                type: action.type,
                payload: action.payload,
                timestamp: new Date().toISOString()
            }
        });
    }
    /**
   * Log game state change
   */ logStateChange(description, changes, context) {
        this.debug('Game state change', {
            ...context,
            description,
            changes
        });
    }
    /**
   * Log validation failure
   */ logValidationFailure(message, validationErrors, context) {
        this.warn('Validation failure', {
            ...context,
            validationErrors,
            message
        });
    }
    /**
   * Log security event (suspicious activity, anti-cheat, etc.)
   */ logSecurityEvent(event, severity, context) {
        if (severity === 'critical' || severity === 'high') {
            this.error(`Security event: ${event}`, undefined, {
                ...context,
                securityEvent: event,
                severity
            });
            return;
        }
        this.warn(`Security event: ${event}`, {
            ...context,
            securityEvent: event,
            severity
        });
    }
    /**
   * Log performance metric
   */ logPerformance(operation, durationMs, context) {
        this.debug('Performance metric', {
            ...context,
            operation,
            durationMs
        });
    }
    /**
   * Get the underlying Winston logger for advanced usage
   */ getLogger() {
        return this.logger;
    }
    constructor(config){
        this.config = config;
        const logLevel = this.config.get('LOG_LEVEL', 'info');
        const enableFiles = this.config.get('LOG_FILES_ENABLED', true);
        const logDir = enableFiles ? this.ensureDirectory(this.config.get('LOG_DIR', 'logs') || 'logs') : null;
        const transports = [
            new _winston.transports.Console({
                format: _winston.format.combine(_winston.format.colorize(), _winston.format.timestamp({
                    format: 'YYYY-MM-DD HH:mm:ss'
                }), _winston.format.printf(({ timestamp, level, message, ...meta })=>{
                    const metaStr = Object.keys(meta).length > 0 ? `\n${JSON.stringify(meta, null, 2)}` : '';
                    return `${String(timestamp)} [${String(level)}]: ${String(message)}${metaStr}`;
                }))
            })
        ];
        if (logDir) {
            transports.push(new _winston.transports.File({
                filename: _path.join(logDir, 'error.log'),
                level: 'error',
                maxsize: 5242880,
                maxFiles: 5
            }), new _winston.transports.File({
                filename: _path.join(logDir, 'combined.log'),
                maxsize: 5242880,
                maxFiles: 5
            }));
        }
        this.logger = _winston.createLogger({
            level: logLevel,
            format: _winston.format.combine(_winston.format.timestamp(), _winston.format.errors({
                stack: true
            }), _winston.format.json()),
            defaultMeta: {
                service: 'game-engine'
            },
            transports
        });
    }
};
GameLoggerService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _config.ConfigService === "undefined" ? Object : _config.ConfigService
    ])
], GameLoggerService);
