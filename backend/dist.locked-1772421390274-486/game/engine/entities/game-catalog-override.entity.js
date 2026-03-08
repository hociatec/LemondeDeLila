"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameCatalogOverrideEntity", {
    enumerable: true,
    get: function() {
        return GameCatalogOverrideEntity;
    }
});
const _typeorm = require("typeorm");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GameCatalogOverrideEntity = class GameCatalogOverrideEntity {
};
_ts_decorate([
    (0, _typeorm.PrimaryColumn)({
        name: 'game_type',
        type: 'varchar',
        length: 100
    }),
    _ts_metadata("design:type", String)
], GameCatalogOverrideEntity.prototype, "gameType", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'boolean',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "enabled", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'min_players',
        type: 'int',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "minPlayers", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'max_players',
        type: 'int',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "maxPlayers", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 255,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "name", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'text',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "description", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'text',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "rules", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 20,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "status", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'chat_enabled',
        type: 'boolean',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "chatEnabled", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'chat_sounds_enabled',
        type: 'boolean',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], GameCatalogOverrideEntity.prototype, "chatSoundsEnabled", void 0);
GameCatalogOverrideEntity = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'game_catalog_overrides'
    })
], GameCatalogOverrideEntity);
