"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "playingLog", {
    enumerable: true,
    get: function() {
        return playingLog;
    }
});
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
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
const LOG_PATH = resolveLogPath();
function playingLog(label, payload) {
    try {
        const line = JSON.stringify({
            ts: new Date().toISOString(),
            label,
            event: label,
            roomId: null,
            gameType: null,
            userId: null,
            type: null,
            ...payload
        });
        _fs.appendFileSync(LOG_PATH, line + '\n', {
            encoding: 'utf-8'
        });
    } catch  {
    /* ignore logging failures */ }
}
function resolveLogPath() {
    const cwd = process.cwd();
    // Priorite au dossier racine "log" (a cote de backend), sinon fallback sur backend/log.
    const rootLog = _path.resolve(cwd, '..', 'log');
    const backendLog = _path.resolve(cwd, 'log');
    const targetDir = _fs.existsSync(rootLog) || ensureDir(rootLog) ? rootLog : ensureDir(backendLog) ? backendLog : backendLog;
    return _path.join(targetDir, 'playing.log');
}
function ensureDir(dir) {
    try {
        if (!_fs.existsSync(dir)) {
            _fs.mkdirSync(dir, {
                recursive: true
            });
        }
        return true;
    } catch  {
        return false;
    }
}
