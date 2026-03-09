"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "TurnModule", {
    enumerable: true,
    get: function() {
        return TurnModule;
    }
});
const _common = require("@nestjs/common");
const _turnservice = require("./services/turn.service");
const _turnactionsservice = require("./services/turn-actions.service");
const _turnmanagerservice = require("./services/turn-manager.service");
const _turnstatusservice = require("./services/turn-status.service");
const _turnlabelservice = require("./services/turn-label.service");
const _turnflowservice = require("./services/turn-flow.service");
const _turnpoliciesmodule = require("../turn-policies/turn-policies.module");
const _gamemoduleoverviewconstants = require("../game-module-overview.constants");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
const turnOverviewProvider = {
    provide: _gamemoduleoverviewconstants.GAME_MODULE_OVERVIEW,
    useExisting: _turnservice.TurnService
};
let TurnModule = class TurnModule {
};
TurnModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            (0, _common.forwardRef)(()=>_turnpoliciesmodule.TurnPoliciesModule)
        ],
        providers: [
            _turnservice.TurnService,
            _turnactionsservice.TurnActionsService,
            _turnmanagerservice.TurnManagerService,
            _turnstatusservice.TurnStatusService,
            _turnlabelservice.TurnLabelService,
            _turnflowservice.TurnFlowService,
            turnOverviewProvider
        ],
        exports: [
            _turnservice.TurnService,
            _turnactionsservice.TurnActionsService,
            _turnmanagerservice.TurnManagerService,
            _turnstatusservice.TurnStatusService,
            _turnlabelservice.TurnLabelService,
            _turnflowservice.TurnFlowService,
            turnOverviewProvider
        ]
    })
], TurnModule);
