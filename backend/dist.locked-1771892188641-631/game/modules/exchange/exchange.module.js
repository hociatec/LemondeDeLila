"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExchangeModule = void 0;
const common_1 = require("@nestjs/common");
const exchange_service_1 = require("./services/exchange.service");
const generic_exchange_service_1 = require("./services/generic-exchange.service");
const interactive_exchange_service_1 = require("./services/interactive-exchange.service");
const random_module_1 = require("../random/random.module");
const game_module_overview_constants_1 = require("../game-module-overview.constants");
const exchangeOverviewProvider = {
    provide: game_module_overview_constants_1.GAME_MODULE_OVERVIEW,
    useExisting: exchange_service_1.ExchangeService,
};
let ExchangeModule = class ExchangeModule {
};
exports.ExchangeModule = ExchangeModule;
exports.ExchangeModule = ExchangeModule = __decorate([
    (0, common_1.Module)({
        imports: [random_module_1.RandomModule],
        providers: [
            exchange_service_1.ExchangeService,
            generic_exchange_service_1.GenericExchangeService,
            interactive_exchange_service_1.InteractiveExchangeService,
            exchangeOverviewProvider,
        ],
        exports: [
            exchange_service_1.ExchangeService,
            generic_exchange_service_1.GenericExchangeService,
            interactive_exchange_service_1.InteractiveExchangeService,
            exchangeOverviewProvider,
        ],
    })
], ExchangeModule);
//# sourceMappingURL=exchange.module.js.map