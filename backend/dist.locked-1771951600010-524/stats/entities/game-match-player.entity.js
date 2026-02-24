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
exports.GameMatchPlayer = void 0;
const typeorm_1 = require("typeorm");
const user_entity_1 = require("../../user/entities/user.entity");
const game_match_entity_1 = require("./game-match.entity");
let GameMatchPlayer = class GameMatchPlayer {
    id;
    match;
    user;
    username;
    outcome;
    leftAt;
};
exports.GameMatchPlayer = GameMatchPlayer;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], GameMatchPlayer.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => game_match_entity_1.GameMatch, (m) => m.players, { eager: false }),
    (0, typeorm_1.JoinColumn)({ name: 'match_id' }),
    (0, typeorm_1.Index)('idx_game_match_players_match'),
    __metadata("design:type", game_match_entity_1.GameMatch)
], GameMatchPlayer.prototype, "match", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User, { eager: true }),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    (0, typeorm_1.Index)('idx_game_match_players_user'),
    __metadata("design:type", user_entity_1.User)
], GameMatchPlayer.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 80 }),
    __metadata("design:type", String)
], GameMatchPlayer.prototype, "username", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 20, default: `'unknown'` }),
    (0, typeorm_1.Index)('idx_game_match_players_outcome'),
    __metadata("design:type", String)
], GameMatchPlayer.prototype, "outcome", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'left_at', type: 'datetime', nullable: true }),
    __metadata("design:type", Object)
], GameMatchPlayer.prototype, "leftAt", void 0);
exports.GameMatchPlayer = GameMatchPlayer = __decorate([
    (0, typeorm_1.Entity)({ name: 'game_match_players' }),
    (0, typeorm_1.Unique)('uniq_game_match_player', ['match', 'user'])
], GameMatchPlayer);
//# sourceMappingURL=game-match-player.entity.js.map