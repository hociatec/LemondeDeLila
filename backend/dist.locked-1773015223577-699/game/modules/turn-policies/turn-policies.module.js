"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TurnPoliciesModule", {
    enumerable: true,
    get: function() {
        return TurnPoliciesModule;
    }
});
const _common = require("@nestjs/common");
const _coremodule = require("../../core/core.module");
const _turnpoliciesservice = require("./services/turn-policies.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let TurnPoliciesModule = class TurnPoliciesModule {
};
TurnPoliciesModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            (0, _common.forwardRef)(()=>_coremodule.GameCoreModule)
        ],
        providers: [
            _turnpoliciesservice.TurnPoliciesService
        ],
        exports: [
            _turnpoliciesservice.TurnPoliciesService
        ]
    })
], TurnPoliciesModule);
