"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "UserModule", {
    enumerable: true,
    get: function() {
        return UserModule;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _userentity = require("./entities/user.entity");
const _userservice = require("./services/user.service");
const _userauthservice = require("./services/user.auth.service");
const _authwshandler = require("./ws/auth-ws.handler");
const _userwshandler = require("./ws/user-ws.handler");
const _userwsregistrar = require("./ws/user-ws.registrar");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let UserModule = class UserModule {
};
UserModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _typeorm.TypeOrmModule.forFeature([
                _userentity.User
            ])
        ],
        providers: [
            _userservice.UserService,
            _userauthservice.UserAuthService,
            _authwshandler.AuthWsHandler,
            _userwshandler.UserWsHandler,
            _userwsregistrar.UserWsRegistrar
        ],
        exports: [
            _userservice.UserService,
            _userauthservice.UserAuthService
        ]
    })
], UserModule);
