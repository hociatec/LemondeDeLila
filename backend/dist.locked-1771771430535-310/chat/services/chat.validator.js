"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatValidator = void 0;
const common_1 = require("@nestjs/common");
const message_sanitizer_1 = require("../../common/utils/message-sanitizer");
let ChatValidator = class ChatValidator {
    validate(text) {
        const sanitized = (0, message_sanitizer_1.sanitizeMessage)(text, {
            encodeHtml: false,
            collapseNewLines: true,
        });
        if (sanitized === '') {
            throw new Error('MESSAGE_REQUIRED');
        }
        if (sanitized.length > message_sanitizer_1.DEFAULT_MESSAGE_MAX_LENGTH) {
            throw new Error('MESSAGE_TOO_LONG');
        }
        return sanitized;
    }
};
exports.ChatValidator = ChatValidator;
exports.ChatValidator = ChatValidator = __decorate([
    (0, common_1.Injectable)()
], ChatValidator);
//# sourceMappingURL=chat.validator.js.map