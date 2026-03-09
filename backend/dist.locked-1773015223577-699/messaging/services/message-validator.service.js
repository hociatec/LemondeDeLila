"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MessageValidatorService", {
    enumerable: true,
    get: function() {
        return MessageValidatorService;
    }
});
const _common = require("@nestjs/common");
const _messagesanitizer = require("../../common/utils/message-sanitizer");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let MessageValidatorService = class MessageValidatorService {
    validate(text) {
        const sanitized = (0, _messagesanitizer.sanitizeMessage)(text, {
            encodeHtml: true,
            collapseNewLines: true
        });
        if (!sanitized) {
            throw new _common.BadRequestException('Le message est requis');
        }
        if (sanitized.length > _messagesanitizer.DEFAULT_MESSAGE_MAX_LENGTH) {
            throw new _common.BadRequestException('Le message est trop long (max 1000 caracteres)');
        }
        return sanitized;
    }
    validateSubject(subject) {
        if (!subject) {
            return null;
        }
        const sanitized = (0, _messagesanitizer.sanitizeMessage)(subject, {
            encodeHtml: true,
            collapseNewLines: true
        }).trim();
        if (!sanitized) {
            return null;
        }
        if (sanitized.length > MessageValidatorService.SUBJECT_MAX_LENGTH) {
            throw new _common.BadRequestException(`Le sujet est trop long (max ${MessageValidatorService.SUBJECT_MAX_LENGTH} caracteres)`);
        }
        return sanitized;
    }
};
MessageValidatorService.SUBJECT_MAX_LENGTH = 200;
MessageValidatorService = _ts_decorate([
    (0, _common.Injectable)()
], MessageValidatorService);
