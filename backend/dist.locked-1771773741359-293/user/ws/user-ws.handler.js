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
exports.UserWsHandler = void 0;
const common_1 = require("@nestjs/common");
const user_service_1 = require("../services/user.service");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const ws_dto_1 = require("./ws.dto");
let UserWsHandler = class UserWsHandler {
    users;
    validator;
    constructor(users, validator) {
        this.users = users;
        this.validator = validator;
    }
    async list() {
        const items = await this.users.findAll();
        return { type: 'users.list', payload: { items } };
    }
    async get(payload) {
        const dto = this.validator.validate(ws_dto_1.UserGetDto, payload);
        const user = await this.users.findOne(dto.id);
        return { type: 'users.get', payload: { user } };
    }
};
exports.UserWsHandler = UserWsHandler;
exports.UserWsHandler = UserWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_service_1.UserService,
        payload_validation_service_1.PayloadValidationService])
], UserWsHandler);
//# sourceMappingURL=user-ws.handler.js.map