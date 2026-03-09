"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BotModule", {
    enumerable: true,
    get: function() {
        return BotModule;
    }
});
const _common = require("@nestjs/common");
const _typeorm = require("@nestjs/typeorm");
const _botstrategyservice = require("./services/bot-strategy.service");
const _botrunnerservice = require("./services/bot-runner.service");
const _botschedulerservice = require("./services/bot-scheduler.service");
const _botsettingsservice = require("./services/bot-settings.service");
const _botsettingsentity = require("./entities/bot-settings.entity");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let BotModule = class BotModule {
};
BotModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _typeorm.TypeOrmModule.forFeature([
                _botsettingsentity.BotSettingsEntity
            ])
        ],
        providers: [
            _botstrategyservice.BotStrategyService,
            _botrunnerservice.BotRunnerService,
            _botschedulerservice.BotSchedulerService,
            _botsettingsservice.BotSettingsService
        ],
        exports: [
            _botstrategyservice.BotStrategyService,
            _botrunnerservice.BotRunnerService,
            _botschedulerservice.BotSchedulerService,
            _botsettingsservice.BotSettingsService
        ]
    })
], BotModule);
