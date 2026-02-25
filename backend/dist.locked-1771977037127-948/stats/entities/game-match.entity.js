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
exports.GameMatch = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../user/entities/user.entity");
const game_match_player_entity_1 = require("./game-match-player.entity");
let GameMatch = class GameMatch {
    id;
    roomId;
    gameType;
    withBots;
    botsCount;
    humansCount;
    startedAt;
    endedAt;
    endedReason;
    winnerUser;
    players;
};
exports.GameMatch = GameMatch;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], GameMatch.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'room_id', type: 'int' }),
    __metadata("design:type", Number)
], GameMatch.prototype, "roomId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'game_type', type: 'varchar', length: 100 }),
    __metadata("design:type", String)
], GameMatch.prototype, "gameType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'with_bots', type: 'boolean', default: false }),
    __metadata("design:type", Boolean)
], GameMatch.prototype, "withBots", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'bots_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], GameMatch.prototype, "botsCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'humans_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], GameMatch.prototype, "humansCount", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'started_at', type: 'datetime' }),
    __metadata("design:type", Date)
], GameMatch.prototype, "startedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ended_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], GameMatch.prototype, "endedAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'ended_reason', type: 'varchar', length: 20, nullable: true }),
    __metadata("design:type", Object)
], GameMatch.prototype, "endedReason", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: true, nullable: true }),
    (0, typeorm_1.JoinColumn)({ name: 'winner_user_id' }),
    __metadata("design:type", Object)
], GameMatch.prototype, "winnerUser", void 0);
__decorate([
    (0, typeorm_1.OneToMany)(() => game_match_player_entity_1.GameMatchPlayer, (p) => p.match),
    __metadata("design:type", Array)
], GameMatch.prototype, "players", void 0);
exports.GameMatch = GameMatch = __decorate([
    (0, typeorm_1.Entity)({ name: 'game_matches' })
], GameMatch);
//# sourceMappingURL=game-match.entity.js.map