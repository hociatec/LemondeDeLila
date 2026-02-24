"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CatalogModule = void 0;
const common_1 = require("@nestjs/common");
const catalog_service_1 = require("./services/catalog.service");
const game_registry_module_1 = require("../game/engine/game-registry.module");
const catalog_ws_handler_1 = require("./ws/catalog-ws.handler");
const catalog_ws_registrar_1 = require("./ws/catalog-ws.registrar");
let CatalogModule = class CatalogModule {
};
exports.CatalogModule = CatalogModule;
exports.CatalogModule = CatalogModule = __decorate([
    (0, common_1.Module)({
        imports: [game_registry_module_1.GameRegistryModule],
        providers: [catalog_service_1.CatalogService, catalog_ws_handler_1.CatalogWsHandler, catalog_ws_registrar_1.CatalogWsRegistrar],
        exports: [catalog_service_1.CatalogService],
    })
], CatalogModule);
//# sourceMappingURL=catalog.module.js.map