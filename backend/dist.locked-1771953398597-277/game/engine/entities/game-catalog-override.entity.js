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
exports.GameCatalogOverrideEntity = void 0;
const typeorm_1 = require("typeorm");
let GameCatalogOverrideEntity = class GameCatalogOverrideEntity {
    gameType;
    enabled;
    minPlayers;
    maxPlayers;
    name;
    description;
    rules;
    status;
    chatEnabled;
    chatSoundsEnabled;
};
exports.GameCatalogOverrideEntity = GameCatalogOverrideEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'game_type', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], GameCatalogOverrideEntity.prototype, "gameType", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', nullable: true }),
    __metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'min_players', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "minPlayers", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'max_players', type: 'int', nullable: true }),
    __metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "maxPlayers", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, nullable: true }),
    __metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text', nullable: true }),
    __metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "rules", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'chat_enabled', type: 'boolean', nullable: true }),
    __metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "chatEnabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'chat_sounds_enabled', type: 'boolean', nullable: true }),
    __metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "chatSoundsEnabled", void 0);
exports.GameCatalogOverrideEntity = GameCatalogOverrideEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'game_catalog_overrides' })
], GameCatalogOverrideEntity);
//# sourceMappingURL=game-catalog-override.entity.js.map