"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CatalogWsRegistrar", {
    enumerable: true,
    get: function() {
        return CatalogWsRegistrar;
    }
});
const _common = require("@nestjs/common");
const _wsrouteregistryservice = require("../../common/ws/ws-route-registry.service");
const _catalogwshandler = require("./catalog-ws.handler");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let CatalogWsRegistrar = class CatalogWsRegistrar {
    onModuleInit() {
        this.registry.register('catalog.all', ()=>this.handler.all());
        this.registry.register('catalog.categories', ()=>this.handler.categories());
        this.registry.register('catalog.categoryGames', (_, payload)=>this.handler.categoryGames(payload));
        this.registry.register('catalog.games', ()=>this.handler.games());
        // Warm-up du cache catalogue pour eviter un premier `catalog.all` tres lent.
        this.handler.games().then((res)=>{
            const payload = res.payload;
            const count = Array.isArray(payload) ? payload.length : 'n/a';
            this.logger.log(`Warm-up catalogue effectue (${count} jeux)`);
        }).catch((err)=>this.logger.warn(`Warm-up catalogue echoue: ${err?.message ?? err}`));
    }
    constructor(registry, handler){
        this.registry = registry;
        this.handler = handler;
        this.logger = new _common.Logger(CatalogWsRegistrar.name);
    }
};
CatalogWsRegistrar = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _wsrouteregistryservice.WsRouteRegistry === "undefined" ? Object : _wsrouteregistryservice.WsRouteRegistry,
        typeof _catalogwshandler.CatalogWsHandler === "undefined" ? Object : _catalogwshandler.CatalogWsHandler
    ])
], CatalogWsRegistrar);
