"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ClientUpdatesUploadTokenGuard", {
    enumerable: true,
    get: function() {
        return ClientUpdatesUploadTokenGuard;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let ClientUpdatesUploadTokenGuard = class ClientUpdatesUploadTokenGuard {
    canActivate(context) {
        const req = context.switchToHttp().getRequest();
        const configured = (process.env.CLIENT_UPDATES_UPLOAD_TOKEN || '').trim();
        if (!configured) {
            throw new _common.UnauthorizedException('CLIENT_UPDATES_UPLOAD_TOKEN non configuré');
        }
        const token = req?.headers?.['x-client-updates-upload-token'] || req?.headers?.['X-Client-Updates-Upload-Token'] || '';
        if (typeof token !== 'string' || token.trim() !== configured) {
            throw new _common.UnauthorizedException('Token upload invalide');
        }
        return true;
    }
};
ClientUpdatesUploadTokenGuard = _ts_decorate([
    (0, _common.Injectable)()
], ClientUpdatesUploadTokenGuard);
