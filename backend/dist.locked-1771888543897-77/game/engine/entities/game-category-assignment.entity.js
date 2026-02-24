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
exports.GameCategoryAssignmentEntity = void 0;
const typeorm_1 = require("typeorm");
let GameCategoryAssignmentEntity = class GameCategoryAssignmentEntity {
    gameType;
    categoryId;
};
exports.GameCategoryAssignmentEntity = GameCategoryAssignmentEntity;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'game_type', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], GameCategoryAssignmentEntity.prototype, "gameType", void 0);
__decorate([
    (0, typeorm_1.Index)(),
    (0, typeorm_1.Column)({ name: 'category_id', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], GameCategoryAssignmentEntity.prototype, "categoryId", void 0);
exports.GameCategoryAssignmentEntity = GameCategoryAssignmentEntity = __decorate([
    (0, typeorm_1.Entity)({ name: 'game_category_assignments' })
], GameCategoryAssignmentEntity);
//# sourceMappingURL=game-category-assignment.entity.js.map