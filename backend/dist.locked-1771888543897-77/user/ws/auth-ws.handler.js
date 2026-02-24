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
exports.AuthWsHandler = void 0;
const common_1 = require("@nestjs/common");
const user_auth_service_1 = require("../services/user.auth.service");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const register_dto_1 = require("../dto/register.dto");
const login_dto_1 = require("../dto/login.dto");
let AuthWsHandler = class AuthWsHandler {
    auth;
    validator;
    constructor(auth, validator) {
        this.auth = auth;
        this.validator = validator;
    }
    async register(payload) {
        const dto = this.validator.validate(register_dto_1.RegisterDto, payload);
        await this.auth.register(dto.email, dto.username, dto.password);
        return { type: 'auth.register.ok', payload: { message: 'inscrit' } };
    }
    async login(payload) {
        const dto = this.validator.validate(login_dto_1.LoginDto, payload);
        const result = await this.auth.login(dto.username, dto.password);
        return { type: 'auth.login.ok', payload: result };
    }
};
exports.AuthWsHandler = AuthWsHandler;
exports.AuthWsHandler = AuthWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_auth_service_1.UserAuthService,
        payload_validation_service_1.PayloadValidationService])
], AuthWsHandler);
//# sourceMappingURL=auth-ws.handler.js.map