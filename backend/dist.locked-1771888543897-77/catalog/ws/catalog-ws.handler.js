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
exports.CatalogWsHandler = void 0;
const common_1 = require("@nestjs/common");
const catalog_service_1 = require("../services/catalog.service");
const payload_validation_service_1 = require("../../common/validation/payload-validation.service");
const ws_dto_1 = require("./ws.dto");
let CatalogWsHandler = class CatalogWsHandler {
    catalog;
    validator;
    constructor(catalog, validator) {
        this.catalog = catalog;
        this.validator = validator;
    }
    async all() {
        const categories = await this.catalog.getCategoriesTree();
        const games = await this.catalog.getAllGames();
        return { type: 'catalog.all', payload: { categories, games } };
    }
    async categories() {
        const categories = await this.catalog.getFlatCategories();
        return { type: 'catalog.categories', payload: categories };
    }
    async categoryGames(payload) {
        const dto = this.validator.validate(ws_dto_1.CatalogCategoryDto, payload);
        const games = await this.catalog.getGamesForCategory(dto.id);
        return { type: 'catalog.categoryGames', payload: games };
    }
    async games() {
        const games = await this.catalog.getAllGames();
        return { type: 'catalog.games', payload: games };
    }
};
exports.CatalogWsHandler = CatalogWsHandler;
exports.CatalogWsHandler = CatalogWsHandler = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [catalog_service_1.CatalogService,
        payload_validation_service_1.PayloadValidationService])
], CatalogWsHandler);
//# sourceMappingURL=catalog-ws.handler.js.map