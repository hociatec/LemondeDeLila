"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "AuthWsHandler", {
    enumerable: true,
    get: function() {
        return AuthWsHandler;
    }
});
const _common = require("@nestjs/common");
const _userauthservice = require("../services/user.auth.service");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _registerdto = require("../dto/register.dto");
const _logindto = require("../dto/login.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let AuthWsHandler = class AuthWsHandler {
    async register(payload) {
        const dto = this.validator.validate(_registerdto.RegisterDto, payload);
        await this.auth.register(dto.email, dto.username, dto.password);
        return {
            type: 'auth.register.ok',
            payload: {
                message: 'inscrit'
            }
        };
    }
    async login(payload) {
        const dto = this.validator.validate(_logindto.LoginDto, payload);
        const result = await this.auth.login(dto.username, dto.password);
        return {
            type: 'auth.login.ok',
            payload: result
        };
    }
    constructor(auth, validator){
        this.auth = auth;
        this.validator = validator;
    }
};
AuthWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _userauthservice.UserAuthService === "undefined" ? Object : _userauthservice.UserAuthService,
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService
    ])
], AuthWsHandler);
