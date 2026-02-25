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
exports.AdminClientUpdatesController = void 0;
const common_1 = require("@nestjs/common");
const platform_express_1 = require("@nestjs/platform-express");
const fs = __importStar(require("fs"));
const os = __importStar(require("os"));
const http_jwt_guard_1 = require("../../common/guards/http-jwt.guard");
const admin_role_guard_1 = require("../../common/guards/admin-role.guard");
const client_updates_upload_dto_1 = require("../dto/client-updates-upload.dto");
const client_updates_upload_service_1 = require("../services/client-updates-upload.service");
function getUploadPath(file) {
    return typeof file?.path === 'string' ? file.path : '';
}
let AdminClientUpdatesController = class AdminClientUpdatesController {
    uploads;
    constructor(uploads) {
        this.uploads = uploads;
    }
    async status() {
        return this.uploads.status();
    }
    async upload(file, body) {
        const zipPath = getUploadPath(file);
        if (!zipPath) {
            throw new common_1.BadRequestException('Fichier manquant (champ "file").');
        }
        try {
            return await this.uploads.uploadSingleZip({
                zipPath,
                version: body?.version,
                message: body?.message,
                minRequiredVersion: body?.minRequiredVersion,
            });
        }
        finally {
            fs.promises.rm(zipPath, { force: true }).catch(() => {
            });
        }
    }
    async init(body) {
        return this.uploads.uploadInit(body);
    }
    async chunk(file, body) {
        const filePath = getUploadPath(file);
        if (!filePath) {
            throw new common_1.BadRequestException('Chunk manquant (champ "file").');
        }
        return this.uploads.uploadChunk({
            uploadId: body?.uploadId ?? '',
            index: body?.index ?? -1,
            filePath,
        });
    }
    async complete(body) {
        return this.uploads.uploadComplete({ uploadId: body.uploadId });
    }
};
exports.AdminClientUpdatesController = AdminClientUpdatesController;
__decorate([
    (0, common_1.Get)('status'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AdminClientUpdatesController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('upload'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        dest: os.tmpdir(),
        limits: { fileSize: 600 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, client_updates_upload_dto_1.ClientUpdatesUploadMetaDto]),
    __metadata("design:returntype", Promise)
], AdminClientUpdatesController.prototype, "upload", null);
__decorate([
    (0, common_1.Post)('upload/init'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [client_updates_upload_dto_1.ClientUpdatesUploadInitDto]),
    __metadata("design:returntype", Promise)
], AdminClientUpdatesController.prototype, "init", null);
__decorate([
    (0, common_1.Post)('upload/chunk'),
    (0, common_1.UseInterceptors)((0, platform_express_1.FileInterceptor)('file', {
        dest: os.tmpdir(),
        limits: { fileSize: 15 * 1024 * 1024 },
    })),
    __param(0, (0, common_1.UploadedFile)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, client_updates_upload_dto_1.ClientUpdatesUploadChunkDto]),
    __metadata("design:returntype", Promise)
], AdminClientUpdatesController.prototype, "chunk", null);
__decorate([
    (0, common_1.Post)('upload/complete'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [client_updates_upload_dto_1.ClientUpdatesUploadCompleteDto]),
    __metadata("design:returntype", Promise)
], AdminClientUpdatesController.prototype, "complete", null);
exports.AdminClientUpdatesController = AdminClientUpdatesController = __decorate([
    (0, common_1.Controller)('api/admin/client-updates'),
    (0, common_1.UseGuards)(http_jwt_guard_1.HttpJwtGuard, admin_role_guard_1.AdminRoleGuard),
    __metadata("design:paramtypes", [client_updates_upload_service_1.ClientUpdatesUploadService])
], AdminClientUpdatesController);
//# sourceMappingURL=admin-client-updates.controller.js.map