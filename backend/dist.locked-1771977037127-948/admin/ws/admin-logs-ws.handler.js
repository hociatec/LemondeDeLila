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
exports.AdminLogsWsHandler = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const ws_auth_1 = require("../../common/ws/ws-auth");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const admin_ws_dto_1 = require("./admin-ws.dto");
let AdminLogsWsHandler = class AdminLogsWsHandler {
    validator;
    config;
    constructor(validator, config) {
        this.validator = validator;
        this.config = config;
    }
    async logsDownload(session, payload) {
        (0, ws_auth_1.requireAdmin)(session);
        const dto = this.validator.validate(admin_ws_dto_1.AdminLogsDownloadWsDto, payload ?? {});
        const linesCount = dto.lines ?? 200;
        const filter = dto.filter?.trim() ?? '';
        const logDir = this.config.get('LOG_DIR') ?? 'log';
        const resolvedDir = path.resolve(logDir);
        let entries;
        try {
            entries = await fs.promises.readdir(resolvedDir);
        }
        catch {
            throw new common_1.BadRequestException('Répertoire de logs introuvable');
        }
        const candidates = await Promise.all(entries
            .filter((entry) => entry.toLowerCase().endsWith('.log'))
            .map(async (entry) => ({
            entry,
            stat: await fs.promises.stat(path.join(resolvedDir, entry)),
        })));
        if (!candidates.length) {
            throw new common_1.BadRequestException('Aucun fichier log disponible');
        }
        candidates.sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);
        const latest = candidates[0];
        const content = await fs.promises.readFile(path.join(resolvedDir, latest.entry), 'utf-8');
        const lines = content.split(/\r?\n/);
        const filtered = filter
            ? lines.filter((line) => line.includes(filter))
            : lines;
        const tail = filtered.slice(-linesCount);
        return {
            type: 'admin.logs.download',
            payload: {
                file: latest.entry,
                lines: tail,
                total: filtered.length,
            },
        };
    }
};
exports.AdminLogsWsHandler = AdminLogsWsHandler;
exports.AdminLogsWsHandler = AdminLogsWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [payload_validation_service_1.PayloadValidationService,
        config_1.ConfigService])
], AdminLogsWsHandler);
//# sourceMappingURL=admin-logs-ws.handler.js.map