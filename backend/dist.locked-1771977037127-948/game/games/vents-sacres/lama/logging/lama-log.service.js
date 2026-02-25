"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LamaLogService = void 0;
const common_1 = require("@nestjs/common");
const log_style_helper_1 = require("../../../../core/helpers/log-style.helper");
let LamaLogService = class LamaLogService {
    append(log, message) {
        const entry = this.buildEntry(message);
        if (!entry) {
            return Array.isArray(log) ? [...log] : [];
        }
        const nextLog = Array.isArray(log) ? [...log] : [];
        const lastMessage = String(nextLog[nextLog.length - 1]?.message ?? '');
        if (lastMessage === entry.message) {
            return nextLog;
        }
        nextLog.push(entry);
        return nextLog;
    }
    buildEntry(message) {
        const normalized = (0, log_style_helper_1.normalizeGameLogMessage)(message);
        if (!normalized) {
            return null;
        }
        return {
            message: normalized,
            timestamp: new Date().toISOString(),
        };
    }
};
exports.LamaLogService = LamaLogService;
exports.LamaLogService = LamaLogService = __decorate([
    (0, common_1.Injectable)()
], LamaLogService);
//# sourceMappingURL=lama-log.service.js.map