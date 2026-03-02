"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CatalogWsHandler", {
    enumerable: true,
    get: function() {
        return CatalogWsHandler;
    }
});
const _common = require("@nestjs/common");
const _catalogservice = require("../services/catalog.service");
const _payloadvalidationservice = require("../../common/validation/payload-validation.service");
const _wsdto = require("./ws.dto");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let CatalogWsHandler = class CatalogWsHandler {
    async all() {
        const categories = await this.catalog.getCategoriesTree();
        const games = await this.catalog.getAllGames();
        return {
            type: 'catalog.all',
            payload: {
                categories,
                games
            }
        };
    }
    async categories() {
        const categories = await this.catalog.getFlatCategories();
        return {
            type: 'catalog.categories',
            payload: categories
        };
    }
    async categoryGames(payload) {
        const dto = this.validator.validate(_wsdto.CatalogCategoryDto, payload);
        const games = await this.catalog.getGamesForCategory(dto.id);
        return {
            type: 'catalog.categoryGames',
            payload: games
        };
    }
    async games() {
        const games = await this.catalog.getAllGames();
        return {
            type: 'catalog.games',
            payload: games
        };
    }
    constructor(catalog, validator){
        this.catalog = catalog;
        this.validator = validator;
    }
};
CatalogWsHandler = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _catalogservice.CatalogService === "undefined" ? Object : _catalogservice.CatalogService,
        typeof _payloadvalidationservice.PayloadValidationService === "undefined" ? Object : _payloadvalidationservice.PayloadValidationService
    ])
], CatalogWsHandler);
