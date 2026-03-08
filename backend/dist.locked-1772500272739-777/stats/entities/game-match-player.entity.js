"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameMatchPlayer", {
    enumerable: true,
    get: function() {
        return GameMatchPlayer;
    }
});
const _typeorm = require("typeorm");
const _userentity = require("../../user/entities/user.entity");
const _gamematchentity = require("./game-match.entity");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GameMatchPlayer = class GameMatchPlayer {
};
_ts_decorate([
    (0, _typeorm.PrimaryGeneratedColumn)(),
    _ts_metadata("design:type", Number)
], GameMatchPlayer.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.ManyToOne)(()=>_gamematchentity.GameMatch, (m)=>m.players, {
        eager: false
    }),
    (0, _typeorm.JoinColumn)({
        name: 'match_id'
    }),
    (0, _typeorm.Index)('idx_game_match_players_match'),
    _ts_metadata("design:type", typeof _typeorm.Relation === "undefined" ? Object : _typeorm.Relation)
], GameMatchPlayer.prototype, "match", void 0);
_ts_decorate([
    (0, _typeorm.ManyToOne)(()=>_userentity.User, {
        eager: true
    }),
    (0, _typeorm.JoinColumn)({
        name: 'user_id'
    }),
    (0, _typeorm.Index)('idx_game_match_players_user'),
    _ts_metadata("design:type", typeof _typeorm.Relation === "undefined" ? Object : _typeorm.Relation)
], GameMatchPlayer.prototype, "user", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 80
    }),
    _ts_metadata("design:type", String)
], GameMatchPlayer.prototype, "username", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        type: 'varchar',
        length: 20,
        default: `'unknown'`
    }),
    (0, _typeorm.Index)('idx_game_match_players_outcome'),
    _ts_metadata("design:type", typeof GameMatchOutcome === "undefined" ? Object : GameMatchOutcome)
], GameMatchPlayer.prototype, "outcome", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'left_at',
        type: 'datetime',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], GameMatchPlayer.prototype, "leftAt", void 0);
GameMatchPlayer = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'game_match_players'
    }),
    (0, _typeorm.Unique)('uniq_game_match_player', [
        'match',
        'user'
    ])
], GameMatchPlayer);
