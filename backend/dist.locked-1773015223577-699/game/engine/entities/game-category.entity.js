"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameCategoryEntity", {
    enumerable: true,
    get: function() {
        return GameCategoryEntity;
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
let GameCategoryEntity = class GameCategoryEntity {
};
_ts_decorate([
    (0, _typeorm.PrimaryColumn)({
        type: 'varchar',
        length: 120
    }),
    _ts_metadata("design:type", String)
], GameCategoryEntity.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 200
    }),
    _ts_metadata("design:type", String)
], GameCategoryEntity.prototype, "name", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'parent_id',
        type: 'varchar',
        length: 120,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], GameCategoryEntity.prototype, "parentId", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'boolean',
        default: true
    }),
    _ts_metadata("design:type", Boolean)
], GameCategoryEntity.prototype, "enabled", void 0);
GameCategoryEntity = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'game_categories'
    })
], GameCategoryEntity);
