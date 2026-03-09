"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "JwksController", {
    enumerable: true,
    get: function() {
        return JwksController;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _crypto = require("crypto");
const _jwtconfig = require("./jwt-config");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let JwksController = class JwksController {
    jwks() {
        const alg = (0, _jwtconfig.getJwtAlgorithm)(this.config);
        if (alg !== 'RS256') {
            throw new _common.NotFoundException();
        }
        const publicKeyPem = (0, _jwtconfig.requireJwtVerifyKey)(this.config);
        const keyObject = (0, _crypto.createPublicKey)(publicKeyPem);
        const jwk = keyObject.export({
            format: 'jwk'
        });
        const kid = (0, _crypto.createHash)('sha256').update(publicKeyPem).digest('hex').slice(0, 16);
        return {
            keys: [
                {
                    ...jwk,
                    use: 'sig',
                    alg: 'RS256',
                    kid
                }
            ]
        };
    }
    // Some deployments proxy only /api/* to the backend. Provide a compatible path as well.
    jwksUnderApi() {
        return this.jwks();
    }
    // Some reverse proxies block /.well-known/* entirely (403). Provide a non-standard alias under /api.
    jwksApiAlias() {
        return this.jwks();
    }
    // Some reverse proxies strip /api before forwarding (proxy_pass .../). Provide a root alias too.
    jwksRootAlias() {
        return this.jwks();
    }
    constructor(config){
        this.config = config;
    }
};
_ts_decorate([
    (0, _common.Get)('.well-known/jwks.json'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], JwksController.prototype, "jwks", null);
_ts_decorate([
    (0, _common.Get)('api/.well-known/jwks.json'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], JwksController.prototype, "jwksUnderApi", null);
_ts_decorate([
    (0, _common.Get)('api/jwks.json'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], JwksController.prototype, "jwksApiAlias", null);
_ts_decorate([
    (0, _common.Get)('jwks.json'),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", []),
    _ts_metadata("design:returntype", void 0)
], JwksController.prototype, "jwksRootAlias", null);
JwksController = _ts_decorate([
    (0, _common.Controller)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _config.ConfigService === "undefined" ? Object : _config.ConfigService
    ])
], JwksController);
