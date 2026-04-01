"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "GameMatch", {
    enumerable: true,
    get: function() {
        return GameMatch;
    }
});
const _typeorm = require("typeorm");
const _userentity = /*#__PURE__*/ _interop_require_wildcard(require("../../user/entities/user.entity"));
const _gamematchplayerentity = /*#__PURE__*/ _interop_require_wildcard(require("./game-match-player.entity"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GameMatch = class GameMatch {
};
_ts_decorate([
    (0, _typeorm.PrimaryGeneratedColumn)(),
    _ts_metadata("design:type", Number)
], GameMatch.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'room_id',
        type: 'int'
    }),
    _ts_metadata("design:type", Number)
], GameMatch.prototype, "roomId", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'game_type',
        type: 'varchar',
        length: 100
    }),
    _ts_metadata("design:type", String)
], GameMatch.prototype, "gameType", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'with_bots',
        type: 'boolean',
        default: false
    }),
    _ts_metadata("design:type", Boolean)
], GameMatch.prototype, "withBots", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'bots_count',
        type: 'int',
        default: 0
    }),
    _ts_metadata("design:type", Number)
], GameMatch.prototype, "botsCount", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'humans_count',
        type: 'int',
        default: 0
    }),
    _ts_metadata("design:type", Number)
], GameMatch.prototype, "humansCount", void 0);
_ts_decorate([
    (0, _typeorm.CreateDateColumn)({
        name: 'started_at',
        type: 'datetime'
    }),
    _ts_metadata("design:type", typeof Date === "undefined" ? Object : Date)
], GameMatch.prototype, "startedAt", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'ended_at',
        type: 'datetime',
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], GameMatch.prototype, "endedAt", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'ended_reason',
        type: 'varchar',
        length: 20,
        nullable: true
    }),
    _ts_metadata("design:type", Object)
], GameMatch.prototype, "endedReason", void 0);
_ts_decorate([
    (0, _typeorm.ManyToOne)(()=>_userentity.User, {
        eager: true,
        nullable: true
    }),
    (0, _typeorm.JoinColumn)({
        name: 'winner_user_id'
    }),
    _ts_metadata("design:type", Object)
], GameMatch.prototype, "winnerUser", void 0);
_ts_decorate([
    (0, _typeorm.OneToMany)(()=>_gamematchplayerentity.GameMatchPlayer, (p)=>p.match),
    _ts_metadata("design:type", typeof Relation === "undefined" ? Object : Relation)
], GameMatch.prototype, "players", void 0);
GameMatch = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'game_matches'
    })
], GameMatch);
