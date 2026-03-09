"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get MessagingConversationDto () {
        return MessagingConversationDto;
    },
    get MessagingListDto () {
        return MessagingListDto;
    },
    get MessagingMarkReadDto () {
        return MessagingMarkReadDto;
    },
    get MessagingSearchDto () {
        return MessagingSearchDto;
    },
    get MessagingSendDto () {
        return MessagingSendDto;
    }
});
const _classvalidator = require("class-validator");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let MessagingConversationDto = class MessagingConversationDto {
};
_ts_decorate([
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.IsPositive)(),
    _ts_metadata("design:type", Number)
], MessagingConversationDto.prototype, "userId", void 0);
_ts_decorate([
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.Min)(1),
    (0, _classvalidator.Max)(500),
    _ts_metadata("design:type", Number)
], MessagingConversationDto.prototype, "limit", void 0);
let MessagingListDto = class MessagingListDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsIn)([
        'inbox',
        'received',
        '',
        'sent',
        'outbox',
        'deleted',
        'trash'
    ]),
    _ts_metadata("design:type", String)
], MessagingListDto.prototype, "box", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.Min)(1),
    (0, _classvalidator.Max)(500),
    _ts_metadata("design:type", Number)
], MessagingListDto.prototype, "limit", void 0);
let MessagingSendDto = class MessagingSendDto {
};
_ts_decorate([
    (0, _classvalidator.IsInt)(),
    (0, _classvalidator.IsPositive)(),
    _ts_metadata("design:type", Number)
], MessagingSendDto.prototype, "recipientId", void 0);
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(1000),
    _ts_metadata("design:type", String)
], MessagingSendDto.prototype, "text", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(200),
    _ts_metadata("design:type", String)
], MessagingSendDto.prototype, "subject", void 0);
let MessagingSearchDto = class MessagingSearchDto {
};
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(255),
    _ts_metadata("design:type", String)
], MessagingSearchDto.prototype, "username", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MaxLength)(255),
    _ts_metadata("design:type", String)
], MessagingSearchDto.prototype, "query", void 0);
let MessagingMarkReadDto = class MessagingMarkReadDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.MinLength)(1),
    (0, _classvalidator.MaxLength)(64),
    _ts_metadata("design:type", String)
], MessagingMarkReadDto.prototype, "messageId", void 0);
