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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServLoggerService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const winston = __importStar(require("winston"));
class ServLoggerService {
    logger;
    constructor() {
        const level = this.resolveLevel();
        const { logFilePath, enabled } = this.resolveFileTarget();
        const transports = [];
        if (enabled && logFilePath) {
            transports.push(new winston.transports.File({
                filename: logFilePath,
                level,
                maxsize: 5 * 1024 * 1024,
                maxFiles: 5,
            }));
        }
        else {
            transports.push(new winston.transports.Console({ level }));
        }
        this.logger = winston.createLogger({
            level,
            format: winston.format.combine(winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }), winston.format.errors({ stack: true }), winston.format.printf(({ timestamp, level, message, ...meta }) => {
                const context = typeof meta.context === 'string' ? meta.context.trim() : '';
                const ctx = context ? ` [${context}]` : '';
                const rest = { ...meta };
                delete rest.context;
                const metaStr = rest && Object.keys(rest).length > 0
                    ? ` ${JSON.stringify(rest)}`
                    : '';
                return `${String(timestamp)} [${String(level)}]${ctx} ${String(message)}${metaStr}`;
            })),
            transports,
        });
    }
    log(message, context) {
        this.logger.info(String(message), { context });
    }
    error(message, trace, context) {
        this.logger.error(String(message), { context, trace });
    }
    warn(message, context) {
        this.logger.warn(String(message), { context });
    }
    debug(message, context) {
        this.logger.debug(String(message), { context });
    }
    verbose(message, context) {
        this.logger.verbose(String(message), { context });
    }
    setLogLevels(levels) {
        const order = {
            error: 0,
            warn: 1,
            log: 2,
            debug: 3,
            verbose: 4,
            fatal: 0,
        };
        const max = Math.max(...levels.map((l) => order[l] ?? 2));
        const mapped = {
            0: 'error',
            1: 'warn',
            2: 'info',
            3: 'debug',
            4: 'verbose',
        };
        const level = mapped[max] ?? 'info';
        this.logger.level = level;
    }
    resolveLevel() {
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
        if (allowed.has(raw))
            return raw;
        const env = (process.env.NODE_ENV || 'development').toLowerCase();
        return env === 'production' ? 'info' : 'debug';
    }
    resolveFileTarget() {
        const enabledRaw = (process.env.LOG_FILES_ENABLED || '')
            .toLowerCase()
            .trim();
        const enabled = enabledRaw === ''
            ? true
            : enabledRaw === 'true' || enabledRaw === '1' || enabledRaw === 'yes';
        if (!enabled) {
            return { enabled: false, logFilePath: null };
        }
        const configuredDir = (process.env.LOG_DIR || '').trim();
        const logDir = configuredDir
            ? path.isAbsolute(configuredDir)
                ? configuredDir
                : path.resolve(process.cwd(), configuredDir)
            : path.resolve(process.cwd(), 'logs');
        const logFilePath = path.join(logDir, 'serv.log');
        try {
            fs.mkdirSync(logDir, { recursive: true });
            return { enabled: true, logFilePath };
        }
        catch {
            return { enabled: false, logFilePath: null };
        }
    }
}
exports.ServLoggerService = ServLoggerService;
//# sourceMappingURL=serv-logger.service.js.map