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
exports.SocialRelationship = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../user/entities/user.entity");
let SocialRelationship = class SocialRelationship {
    id;
    requester;
    addressee;
    status;
    createdAt;
    updatedAt;
};
exports.SocialRelationship = SocialRelationship;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], SocialRelationship.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: true, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'requester_id' }),
    __metadata("design:type", user_entity_1.User)
], SocialRelationship.prototype, "requester", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: true, onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'addressee_id' }),
    __metadata("design:type", user_entity_1.User)
], SocialRelationship.prototype, "addressee", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: 'pending' }),
    __metadata("design:type", String)
], SocialRelationship.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'datetime' }),
    __metadata("design:type", Date)
], SocialRelationship.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at', type: 'datetime' }),
    __metadata("design:type", Date)
], SocialRelationship.prototype, "updatedAt", void 0);
exports.SocialRelationship = SocialRelationship = __decorate([
    (0, typeorm_1.Entity)({ name: 'social_relationships' }),
    (0, typeorm_1.Unique)('uniq_social_relationship_status', ['requester', 'addressee', 'status']),
    (0, typeorm_1.Index)('idx_social_relationship_status', ['status']),
    (0, typeorm_1.Index)('idx_social_relationship_requester', ['requester']),
    (0, typeorm_1.Index)('idx_social_relationship_addressee', ['addressee'])
], SocialRelationship);
//# sourceMappingURL=social-relationship.entity.js.map