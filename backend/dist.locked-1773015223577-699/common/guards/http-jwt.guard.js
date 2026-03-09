"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "HttpJwtGuard", {
    enumerable: true,
    get: function() {
        return HttpJwtGuard;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _jsonwebtoken = /*#__PURE__*/ _interop_require_default(require("jsonwebtoken"));
const _jwtconfig = require("../auth/jwt-config");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let HttpJwtGuard = class HttpJwtGuard {
    canActivate(context) {
        const request = context.switchToHttp().getRequest();
        const token = this.extractBearer(request.headers);
        const payload = this.verify(token);
        request.user = payload;
        return true;
    }
    extractBearer(headers) {
        if (!headers) {
            throw new _common.UnauthorizedException('Authorization requise');
        }
        const authHeader = headers['authorization'] || headers['Authorization'];
        if (!authHeader || typeof authHeader !== 'string') {
            throw new _common.UnauthorizedException('Authorization requise');
        }
        const parts = authHeader.split(' ');
        if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer' || !parts[1]) {
            throw new _common.UnauthorizedException('Authorization Bearer invalide');
        }
        return parts[1];
    }
    verify(token) {
        const key = (0, _jwtconfig.requireJwtVerifyKey)(this.config);
        const issuer = this.config.get('JWT_ISSUER', 'le-monde-de-lila');
        const audienceRaw = this.config.get('JWT_AUDIENCE');
        const audience = audienceRaw && typeof audienceRaw === 'string' && audienceRaw.trim() ? audienceRaw.trim() : undefined;
        const clockTolerance = this.config.get('JWT_CLOCK_TOLERANCE_SECONDS', 10);
        try {
            const verifyOptions = {
                algorithms: (0, _jwtconfig.getJwtVerifyAlgorithms)(this.config),
                issuer,
                clockTolerance
            };
            if (audience) {
                verifyOptions.audience = audience;
            }
            const payload = jwtVerify(token, key, verifyOptions);
            if (!payload || typeof payload !== 'object') {
                throw new _common.UnauthorizedException('Token invalide');
            }
            const typedPayload = payload;
            if (typeof typedPayload.sub !== 'string' || !typedPayload.sub.trim() || typeof typedPayload.exp !== 'number' || typeof typedPayload.iat !== 'number') {
                throw new _common.UnauthorizedException('Token invalide');
            }
            return typedPayload;
        } catch  {
            throw new _common.UnauthorizedException('Token invalide');
        }
    }
    constructor(config){
        this.config = config;
    }
};
HttpJwtGuard = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _config.ConfigService === "undefined" ? Object : _config.ConfigService
    ])
], HttpJwtGuard);
const jwtVerify = _jsonwebtoken.default.verify;
