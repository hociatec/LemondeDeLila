"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ExchangeModule", {
    enumerable: true,
    get: function() {
        return ExchangeModule;
    }
});
const _common = require("@nestjs/common");
const _exchangeservice = require("./services/exchange.service");
const _genericexchangeservice = require("./services/generic-exchange.service");
const _interactiveexchangeservice = require("./services/interactive-exchange.service");
const _randommodule = require("../random/random.module");
const _gamemoduleoverviewconstants = require("../game-module-overview.constants");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
const exchangeOverviewProvider = {
    provide: _gamemoduleoverviewconstants.GAME_MODULE_OVERVIEW,
    useExisting: _exchangeservice.ExchangeService
};
let ExchangeModule = class ExchangeModule {
};
ExchangeModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _randommodule.RandomModule
        ],
        providers: [
            _exchangeservice.ExchangeService,
            _genericexchangeservice.GenericExchangeService,
            _interactiveexchangeservice.InteractiveExchangeService,
            exchangeOverviewProvider
        ],
        exports: [
            _exchangeservice.ExchangeService,
            _genericexchangeservice.GenericExchangeService,
            _interactiveexchangeservice.InteractiveExchangeService,
            exchangeOverviewProvider
        ]
    })
], ExchangeModule);
