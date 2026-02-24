"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JwksController = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto_1 = require("crypto");
const jwt_config_1 = require("./jwt-config");
let JwksController = class JwksController {
    config;
    constructor(config) {
        this.config = config;
    }
    jwks() {
        const alg = (0, jwt_config_1.getJwtAlgorithm)(this.config);
        if (alg !== 'RS256') {
            throw new common_1.NotFoundException();
        }
        const publicKeyPem = (0, jwt_config_1.requireJwtVerifyKey)(this.config);
        const keyObject = (0, crypto_1.createPublicKey)(publicKeyPem);
        const jwk = keyObject.export({ format: 'jwk' });
        const kid = (0, crypto_1.createHash)('sha256')
            .update(publicKeyPem)
            .digest('hex')
            .slice(0, 16);
        return {
            keys: [
                {
                    ...jwk,
                    use: 'sig',
                    alg: 'RS256',
                    kid,
                },
            ],
        };
    }
    jwksUnderApi() {
        return this.jwks();
    }
    jwksApiAlias() {
        return this.jwks();
    }
    jwksRootAlias() {
        return this.jwks();
    }
};
exports.JwksController = JwksController;
__decorate([
    (0, common_1.Get)('.well-known/jwks.json'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JwksController.prototype, "jwks", null);
__decorate([
    (0, common_1.Get)('api/.well-known/jwks.json'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JwksController.prototype, "jwksUnderApi", null);
__decorate([
    (0, common_1.Get)('api/jwks.json'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JwksController.prototype, "jwksApiAlias", null);
__decorate([
    (0, common_1.Get)('jwks.json'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], JwksController.prototype, "jwksRootAlias", null);
exports.JwksController = JwksController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], JwksController);
//# sourceMappingURL=jwks.controller.js.map