"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SoundsModule", {
    enumerable: true,
    get: function() {
        return SoundsModule;
    }
});
const _common = require("@nestjs/common");
const _soundscontroller = require("./sounds.controller");
const _soundsservice = require("./sounds.service");
const _adminsoundscontroller = require("./admin-sounds.controller");
const _notificationmodule = require("../notification/notification.module");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let SoundsModule = class SoundsModule {
};
SoundsModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _notificationmodule.NotificationModule
        ],
        controllers: [
            _soundscontroller.SoundsController,
            _adminsoundscontroller.AdminSoundsController
        ],
        providers: [
            _soundsservice.SoundsService
        ],
        exports: [
            _soundsservice.SoundsService
        ]
    })
], SoundsModule);
