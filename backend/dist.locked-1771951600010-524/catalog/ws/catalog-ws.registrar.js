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
var CatalogWsRegistrar_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogWsRegistrar = void 0;
const common_1 = require("@nestjs/common");
const ws_route_registry_service_1 = require("../../common/ws/ws-route-registry.service");
const catalog_ws_handler_1 = require("./catalog-ws.handler");
let CatalogWsRegistrar = CatalogWsRegistrar_1 = class CatalogWsRegistrar {
    registry;
    handler;
    logger = new common_1.Logger(CatalogWsRegistrar_1.name);
    constructor(registry, handler) {
        this.registry = registry;
        this.handler = handler;
    }
    onModuleInit() {
        this.registry.register('catalog.all', () => this.handler.all());
        this.registry.register('catalog.categories', () => this.handler.categories());
        this.registry.register('catalog.categoryGames', (_, payload) => this.handler.categoryGames(payload));
        this.registry.register('catalog.games', () => this.handler.games());
        this.handler
            .games()
            .then((res) => {
            const payload = res.payload;
            const count = Array.isArray(payload) ? payload.length : 'n/a';
            this.logger.log(`Warm-up catalogue effectue (${count} jeux)`);
        })
            .catch((err) => this.logger.warn(`Warm-up catalogue echoue: ${err?.message ?? err}`));
    }
};
exports.CatalogWsRegistrar = CatalogWsRegistrar;
exports.CatalogWsRegistrar = CatalogWsRegistrar = CatalogWsRegistrar_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [ws_route_registry_service_1.WsRouteRegistry,
        catalog_ws_handler_1.CatalogWsHandler])
], CatalogWsRegistrar);
//# sourceMappingURL=catalog-ws.registrar.js.map