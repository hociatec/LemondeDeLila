"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "UserWsHandler", {
    enumerable: true,
    get: function() {
        return UserWsHandler;
    }
});
const _common = require("@nestjs/common");
const _userservice = require("../services/user.service");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _wsdto = require("./ws.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let UserWsHandler = class UserWsHandler {
    async list() {
        const items = await this.users.findAll();
        return {
            type: 'users.list',
            payload: {
                items
            }
        };
    }
    async get(payload) {
        const dto = this.validator.validate(_wsdto.UserGetDto, payload);
        const user = await this.users.findOne(dto.id);
        return {
            type: 'users.get',
            payload: {
                user
            }
        };
    }
    constructor(users, validator){
        this.users = users;
        this.validator = validator;
    }
};
UserWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _userservice.UserService === "undefined" ? Object : _userservice.UserService,
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService
    ])
], UserWsHandler);
