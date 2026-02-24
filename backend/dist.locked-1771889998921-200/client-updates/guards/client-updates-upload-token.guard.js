"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ClientUpdatesUploadTokenGuard = void 0;
const common_1 = require("@nestjs/common");
let ClientUpdatesUploadTokenGuard = class ClientUpdatesUploadTokenGuard {
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const configured = (process.env.CLIENT_UPDATES_UPLOAD_TOKEN || '').trim();
        if (!configured) {
            throw new common_1.UnauthorizedException('CLIENT_UPDATES_UPLOAD_TOKEN non configuré');
        }
        const token = req?.headers?.['x-client-updates-upload-token'] ||
            req?.headers?.['X-Client-Updates-Upload-Token'] ||
            '';
        if (typeof token !== 'string' || token.trim() !== configured) {
            throw new common_1.UnauthorizedException('Token upload invalide');
        }
        return true;
    }
};
exports.ClientUpdatesUploadTokenGuard = ClientUpdatesUploadTokenGuard;
exports.ClientUpdatesUploadTokenGuard = ClientUpdatesUploadTokenGuard = __decorate([
    (0, common_1.Injectable)()
], ClientUpdatesUploadTokenGuard);
//# sourceMappingURL=client-updates-upload-token.guard.js.map