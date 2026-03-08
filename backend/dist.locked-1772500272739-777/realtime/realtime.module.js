"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RealtimeModule", {
    enumerable: true,
    get: function() {
        return RealtimeModule;
    }
});
const _common = require("@nestjs/common");
const _config = require("@nestjs/config");
const _realtimeapigateway = require("./gateways/realtime-api.gateway");
const _sessionstoreinterface = require("../common/session/session-store.interface");
const _redissessionstore = require("../common/session/redis-session-store");
const _clientupdatesmodule = require("../client-updates/client-updates.module");
const _apicapabilitiesregistrar = require("./ws/api-capabilities.registrar");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let RealtimeModule = class RealtimeModule {
};
RealtimeModule = _ts_decorate([
    (0, _common.Module)({
        imports: [
            _clientupdatesmodule.ClientUpdatesModule
        ],
        providers: [
            {
                provide: _sessionstoreinterface.SESSION_STORE,
                inject: [
                    _config.ConfigService
                ],
                useFactory: (config)=>{
                    const redisUrl = config.get('SESSION_STORE_REDIS_URL') || config.get('REDIS_URL');
                    if (!redisUrl) {
                        throw new Error('SESSION_STORE_REDIS_URL doit être défini pour le module realtime.');
                    }
                    return new _redissessionstore.RedisSessionStore(redisUrl);
                }
            },
            _realtimeapigateway.RealtimeApiGateway,
            _apicapabilitiesregistrar.ApiCapabilitiesWsRegistrar
        ]
    })
], RealtimeModule);
