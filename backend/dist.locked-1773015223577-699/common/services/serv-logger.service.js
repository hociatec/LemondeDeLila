"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ServLoggerService", {
    enumerable: true,
    get: function() {
        return ServLoggerService;
    }
});
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
const _winston = /*#__PURE__*/ _interop_require_wildcard(require("winston"));
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
let ServLoggerService = class ServLoggerService {
    log(message, context) {
        this.logger.info(String(message), {
            context
        });
    }
    error(message, trace, context) {
        this.logger.error(String(message), {
            context,
            trace
        });
    }
    warn(message, context) {
        this.logger.warn(String(message), {
            context
        });
    }
    debug(message, context) {
        this.logger.debug(String(message), {
            context
        });
    }
    verbose(message, context) {
        this.logger.verbose(String(message), {
            context
        });
    }
    setLogLevels(levels) {
        const order = {
            error: 0,
            warn: 1,
            log: 2,
            debug: 3,
            verbose: 4,
            fatal: 0
        };
        const max = Math.max(...levels.map((l)=>order[l] ?? 2));
        const mapped = {
            0: 'error',
            1: 'warn',
            2: 'info',
            3: 'debug',
            4: 'verbose'
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
            'silly'
        ]);
        if (allowed.has(raw)) return raw;
        const env = (process.env.NODE_ENV || 'development').toLowerCase();
        return env === 'production' ? 'info' : 'debug';
    }
    resolveFileTarget() {
        // Le backend tourne généralement depuis `backend/`, donc `../log/serv.log` pointe sur la racine du repo.
        const enabledRaw = (process.env.LOG_FILES_ENABLED || '').toLowerCase().trim();
        const enabled = enabledRaw === '' ? true : enabledRaw === 'true' || enabledRaw === '1' || enabledRaw === 'yes';
        if (!enabled) {
            return {
                enabled: false,
                logFilePath: null
            };
        }
        const configuredDir = (process.env.LOG_DIR || '').trim();
        const logDir = configuredDir ? _path.isAbsolute(configuredDir) ? configuredDir : _path.resolve(process.cwd(), configuredDir) : _path.resolve(process.cwd(), 'logs');
        const logFilePath = _path.join(logDir, 'serv.log');
        try {
            _fs.mkdirSync(logDir, {
                recursive: true
            });
            return {
                enabled: true,
                logFilePath
            };
        } catch  {
            return {
                enabled: false,
                logFilePath: null
            };
        }
    }
    constructor(){
        const level = this.resolveLevel();
        const { logFilePath, enabled } = this.resolveFileTarget();
        const transports = [];
        if (enabled && logFilePath) {
            transports.push(new _winston.transports.File({
                filename: logFilePath,
                level,
                maxsize: 5 * 1024 * 1024,
                maxFiles: 5
            }));
        } else {
            // Fallback (dev/CI) : si on ne peut pas écrire le fichier, on évite de faire planter le serveur.
            transports.push(new _winston.transports.Console({
                level
            }));
        }
        this.logger = _winston.createLogger({
            level,
            format: _winston.format.combine(_winston.format.timestamp({
                format: 'YYYY-MM-DD HH:mm:ss.SSS'
            }), _winston.format.errors({
                stack: true
            }), _winston.format.printf(({ timestamp, level, message, ...meta })=>{
                const context = typeof meta.context === 'string' ? meta.context.trim() : '';
                const ctx = context ? ` [${context}]` : '';
                const rest = {
                    ...meta
                };
                delete rest.context;
                const metaStr = rest && Object.keys(rest).length > 0 ? ` ${JSON.stringify(rest)}` : '';
                return `${String(timestamp)} [${String(level)}]${ctx} ${String(message)}${metaStr}`;
            })),
            transports
        });
    }
};
