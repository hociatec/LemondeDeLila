"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ChatSettingsEntity", {
    enumerable: true,
    get: function() {
        return ChatSettingsEntity;
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
let ChatSettingsEntity = class ChatSettingsEntity {
};
_ts_decorate([
    (0, _typeorm.PrimaryColumn)({
        type: 'tinyint'
    }),
    _ts_metadata("design:type", Number)
], ChatSettingsEntity.prototype, "id", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'chat_history_limit',
        type: 'int',
        default: 200
    }),
    _ts_metadata("design:type", Number)
], ChatSettingsEntity.prototype, "chatHistoryLimit", void 0);
_ts_decorate([
    (0, _typeorm.Column)({
        name: 'edit_window_seconds',
        type: 'int',
        default: 300
    }),
    _ts_metadata("design:type", Number)
], ChatSettingsEntity.prototype, "editWindowSeconds", void 0);
ChatSettingsEntity = _ts_decorate([
    (0, _typeorm.Entity)({
        name: 'chat_settings'
    })
], ChatSettingsEntity);
