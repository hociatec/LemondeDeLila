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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminSoundsController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const multer_1 = require("multer");
const os = __importStar(require("os"));
const http_jwt_guard_1 = require("../common/guards/http-jwt.guard");
const admin_role_guard_1 = require("../common/guards/admin-role.guard");
const sounds_service_1 = require("./sounds.service");
let AdminSoundsController = class AdminSoundsController {
    sounds;
    constructor(sounds) {
        this.sounds = sounds;
    }
    async cleanup() {
        return this.sounds.cleanupUnusedSounds();
    }
    async reencodeAll() {
        return this.sounds.reencodeAllSounds();
    }
    async reencodeInvalid() {
        return this.sounds.reencodeInvalidSounds();
    }
    async diagnostic() {
        return this.sounds.diagnoseSounds();
    }
    async listTableAmbiences() {
        return this.sounds.listTableAmbiences();
    }
    async createTableAmbience(body) {
        return this.sounds.createTableAmbience(body?.name);
    }
    async renameTableAmbience(soundId, body) {
        return this.sounds.renameTableAmbience(soundId, body?.name);
    }
    async deleteTableAmbience(soundId) {
        return this.sounds.deleteTableAmbience(soundId);
    }
    async upload(soundId, file) {
        if (!file?.path) {
            throw new common_1.BadRequestException('Fichier manquant (champ "file").');
        }
        try {
            const entry = await this.sounds.setSound(soundId, file.path, file.originalname);
            return { ok: true, sound: entry };
        }
        finally {
            try {
                const fs = await import('fs');
                fs.promises.rm(file.path, { force: true }).catch(() => undefined);
            }
            catch {
            }
        }
    }
    async clear(soundId) {
        return this.sounds.clearSound(soundId);
    }
};
exports.AdminSoundsController = AdminSoundsController;
__decorate([
    (0, common_1.Post)('cleanup'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "cleanup", null);
__decorate([
    (0, common_1.Post)('reencode'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "reencodeAll", null);
__decorate([
    (0, common_1.Post)('reencode-invalid'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "reencodeInvalid", null);
__decorate([
    (0, common_1.Get)('diagnostic'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "diagnostic", null);
__decorate([
    (0, common_1.Get)('table-ambiences'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "listTableAmbiences", null);
__decorate([
    (0, common_1.Post)('table-ambiences'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "createTableAmbience", null);
__decorate([
    (0, common_1.Put)('table-ambiences/:soundId'),
    __param(0, (0, common_1.Param)('soundId')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "renameTableAmbience", null);
__decorate([
    (0, common_1.Delete)('table-ambiences/:soundId'),
    __param(0, (0, common_1.Param)('soundId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "deleteTableAmbience", null);
__decorate([
    (0, common_1.Post)(':soundId'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        storage: (0, multer_1.diskStorage)({
            destination: (_req, _file, cb) => cb(null, os.tmpdir()),
            filename: (_req, file, cb) => cb(null, `lila-sound-${Date.now()}-${file.originalname}`),
        }),
        limits: { fileSize: 250 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.Param)('soundId')),
    __param(1, (0, common_1.UploadedFile)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "upload", null);
__decorate([
    (0, common_1.Delete)(':soundId'),
    __param(0, (0, common_1.Param)('soundId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminSoundsController.prototype, "clear", null);
exports.AdminSoundsController = AdminSoundsController = __decorate([
    (0, common_1.Controller)('api/admin/sounds'),
    (0, common_1.UseGuards)(http_jwt_guard_1.HttpJwtGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:paramtypes", [sounds_service_1.SoundsService])
], AdminSoundsController);
//# sourceMappingURL=admin-sounds.controller.js.map