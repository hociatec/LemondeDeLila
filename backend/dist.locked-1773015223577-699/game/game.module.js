"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameModule", {
    enumerable: true,
    get: function() {
        return GameModule;
    }
});
const _common = require("@nestjs/common");
const _enginemodule = require("./engine/engine.module");
const _gamepluginsmodule = require("./engine/game-plugins.module");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let GameModule = class GameModule {
};
GameModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _enginemodule.EngineModule,
            _gamepluginsmodule.GamePluginsModule.forRoot()
        ],
        exports: [
            _enginemodule.EngineModule
        ]
    })
], GameModule);
