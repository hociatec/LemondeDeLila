"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RoleDefinitionEntity", {
    enumerable: true,
    get: function() {
        return RoleDefinitionEntity;
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
let RoleDefinitionEntity = class RoleDefinitionEntity {
};
_ts_decorate([
    (0, _typeorm.PrimaryColumn)({
        type: 'varchar',
        length: 100
    }),
    _ts_metadata("design:type", String)
], RoleDefinitionEntity.prototype, "name", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 255
    }),
    _ts_metadata("design:type", String)
], RoleDefinitionEntity.prototype, "description", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'json'
    }),
    _ts_metadata("design:type", Array)
], RoleDefinitionEntity.prototype, "permissions", void 0);
RoleDefinitionEntity = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'role_definitions'
    })
], RoleDefinitionEntity);
