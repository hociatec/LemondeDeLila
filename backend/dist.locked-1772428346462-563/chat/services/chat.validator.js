"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "ChatValidator", {
    enumerable: true,
    get: function() {
        return ChatValidator;
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
let ChatValidator = class ChatValidator {
    validate(text) {
        const sanitized = (0, _messagesanitizer.sanitizeMessage)(text, {
            encodeHtml: false,
            collapseNewLines: true
        });
        if (sanitized === '') {
            throw new Error('MESSAGE_REQUIRED');
        }
        if (sanitized.length > _messagesanitizer.DEFAULT_MESSAGE_MAX_LENGTH) {
            throw new Error('MESSAGE_TOO_LONG');
        }
        return sanitized;
    }
};
ChatValidator = _ts_decorate([
    (0, _common.Injectable)()
], ChatValidator);
