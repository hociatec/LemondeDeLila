"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaLogService", {
    enumerable: true,
    get: function() {
        return LamaLogService;
    }
});
const _common = require("@nestjs/common");
const _logstylehelper = require("../../../../core/helpers/log-style.helper");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let LamaLogService = class LamaLogService {
    append(log, message) {
        const entry = this.buildEntry(message);
        if (!entry) {
            return Array.isArray(log) ? [
                ...log
            ] : [];
        }
        const nextLog = Array.isArray(log) ? [
            ...log
        ] : [];
        const lastMessage = String(nextLog[nextLog.length - 1]?.message ?? '');
        if (lastMessage === entry.message) {
            return nextLog;
        }
        nextLog.push(entry);
        return nextLog;
    }
    buildEntry(message) {
        const normalized = (0, _logstylehelper.normalizeGameLogMessage)(message);
        if (!normalized) {
            return null;
        }
        return {
            message: normalized,
            timestamp: new Date().toISOString()
        };
    }
};
LamaLogService = _ts_decorate([
    (0, _common.Injectable)()
], LamaLogService);
