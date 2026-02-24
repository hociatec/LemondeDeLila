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
exports.RoleDefinitionEntity = void 0;
const typeorm_1 = require("typeorm");
let RoleDefinitionEntity = class RoleDefinitionEntity {
    name;
    description;
    permissions;
};
exports.RoleDefinitionEntity = RoleDefinitionEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], RoleDefinitionEntity.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255 }),
    __metadata("design:type", String)
], RoleDefinitionEntity.prototype, "description", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json' }),
    __metadata("design:type", Array)
], RoleDefinitionEntity.prototype, "permissions", void 0);
exports.RoleDefinitionEntity = RoleDefinitionEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'role_definitions' })
], RoleDefinitionEntity);
//# sourceMappingURL=role-definition.entity.js.map