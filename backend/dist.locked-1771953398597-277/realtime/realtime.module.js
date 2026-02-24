"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RealtimeModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const realtime_api_gateway_1 = require("./gateways/realtime-api.gateway");
const session_store_interface_1 = require("../common/session/session-store.interface");
const redis_session_store_1 = require("../common/session/redis-session-store");
const client_updates_module_1 = require("../client-updates/client-updates.module");
const api_capabilities_registrar_1 = require("./ws/api-capabilities.registrar");
let RealtimeModule = class RealtimeModule {
};
exports.RealtimeModule = RealtimeModule;
exports.RealtimeModule = RealtimeModule = __decorate([
    (0, common_1.Module)({
        imports: [client_updates_module_1.ClientUpdatesModule],
        providers: [
            {
                provide: session_store_interface_1.SESSION_STORE,
                inject: [config_1.ConfigService],
                useFactory: (config) => {
                    const redisUrl = config.get('SESSION_STORE_REDIS_URL') ||
                        config.get('REDIS_URL');
                    if (!redisUrl) {
                        throw new Error('SESSION_STORE_REDIS_URL doit être défini pour le module realtime.');
                    }
                    return new redis_session_store_1.RedisSessionStore(redisUrl);
                },
            },
            realtime_api_gateway_1.RealtimeApiGateway,
            api_capabilities_registrar_1.ApiCapabilitiesWsRegistrar,
        ],
    })
], RealtimeModule);
//# sourceMappingURL=realtime.module.js.map