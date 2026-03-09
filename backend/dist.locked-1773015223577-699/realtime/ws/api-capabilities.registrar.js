"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ApiCapabilitiesWsRegistrar", {
    enumerable: true,
    get: function() {
        return ApiCapabilitiesWsRegistrar;
    }
});
const _common = require("@nestjs/common");
const _wsrouteregistryservice = require("../../common/ws/ws-route-registry.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let ApiCapabilitiesWsRegistrar = class ApiCapabilitiesWsRegistrar {
    onModuleInit() {
        this.registry.register('api.capabilities', async (session, _payload)=>{
            // Keep this payload stable: clients can use it to avoid sending unsupported WS messages.
            const roles = Array.isArray(session.user?.roles) ? session.user.roles : [];
            const isAdmin = roles.includes('ROLE_ADMIN') || roles.includes('admin');
            const wsTypes = this.registry.listTypes();
            return {
                type: 'api.capabilities',
                payload: {
                    isAdmin,
                    features: {
                        'admin.rooms.list': this.registry.has('admin.rooms.list'),
                        'admin.rooms.destroy': this.registry.has('admin.rooms.destroy'),
                        'admin.rooms.cleanup': this.registry.has('admin.rooms.cleanup')
                    },
                    routesCount: this.registry.listTypes().length,
                    wsTypes,
                    generatedAt: new Date().toISOString()
                }
            };
        });
    }
    constructor(registry){
        this.registry = registry;
    }
};
ApiCapabilitiesWsRegistrar = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsrouteregistryservice.WsRouteRegistry === "undefined" ? Object : _wsrouteregistryservice.WsRouteRegistry
    ])
], ApiCapabilitiesWsRegistrar);
