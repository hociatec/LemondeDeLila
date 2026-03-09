"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MulterErrorFilter", {
    enumerable: true,
    get: function() {
        return MulterErrorFilter;
    }
});
const _common = require("@nestjs/common");
const _multer = require("multer");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let MulterErrorFilter = class MulterErrorFilter {
    catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const code = String(exception?.code ?? '').trim();
        const status = code === 'LIMIT_FILE_SIZE' ? 413 : 400;
        const message = code === 'LIMIT_FILE_SIZE' ? "Fichier trop volumineux (limite d'upload atteinte)." : (exception.message || '').trim() || 'Upload invalide.';
        response.status(status).json({
            statusCode: status,
            message,
            error: status === 413 ? 'Payload Too Large' : 'Bad Request'
        });
    }
};
MulterErrorFilter = _ts_decorate([
    (0, _common.Catch)(_multer.MulterError)
], MulterErrorFilter);
