"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ApiCapabilitiesWsRegistrar = void 0;
const common_1 = require("@nestjs/common");
const ws_route_registry_service_1 = require("../../common/ws/ws-route-registry.service");
let ApiCapabilitiesWsRegistrar = class ApiCapabilitiesWsRegistrar {
    registry;
    constructor(registry) {
        this.registry = registry;
    }
    onModuleInit() {
        this.registry.register('api.capabilities', async (session, _payload) => {
            const roles = Array.isArray(session.user?.roles)
                ? session.user.roles
                : [];
            const isAdmin = roles.includes('ROLE_ADMIN') || roles.includes('admin');
            const wsTypes = this.registry.listTypes();
            return {
                type: 'api.capabilities',
                payload: {
                    isAdmin,
                    features: {
                        'admin.rooms.list': this.registry.has('admin.rooms.list'),
                        'admin.rooms.destroy': this.registry.has('admin.rooms.destroy'),
                        'admin.rooms.cleanup': this.registry.has('admin.rooms.cleanup'),
                    },
                    routesCount: this.registry.listTypes().length,
                    wsTypes,
                    generatedAt: new Date().toISOString(),
                },
            };
        });
    }
};
exports.ApiCapabilitiesWsRegistrar = ApiCapabilitiesWsRegistrar;
exports.ApiCapabilitiesWsRegistrar = ApiCapabilitiesWsRegistrar = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ws_route_registry_service_1.WsRouteRegistry])
], ApiCapabilitiesWsRegistrar);
//# sourceMappingURL=api-capabilities.registrar.js.map