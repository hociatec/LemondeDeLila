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
exports.playingLog = playingLog;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
            ...payload,
        });
        fs.appendFileSync(LOG_PATH, line + '\n', { encoding: 'utf-8' });
    }
    catch {
    }
}
function resolveLogPath() {
    const cwd = process.cwd();
    const rootLog = path.resolve(cwd, '..', 'log');
    const backendLog = path.resolve(cwd, 'log');
    const targetDir = fs.existsSync(rootLog) || ensureDir(rootLog)
        ? rootLog
        : ensureDir(backendLog)
            ? backendLog
            : backendLog;
    return path.join(targetDir, 'playing.log');
}
function ensureDir(dir) {
    try {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        return true;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=playing-logger.js.map