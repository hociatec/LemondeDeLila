"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MessageValidatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageValidatorService = void 0;
const common_1 = require("@nestjs/common");
const message_sanitizer_1 = require("../../common/utils/message-sanitizer");
let MessageValidatorService = class MessageValidatorService {
    static { MessageValidatorService_1 = this; }
    static SUBJECT_MAX_LENGTH = 200;
    validate(text) {
        const sanitized = (0, message_sanitizer_1.sanitizeMessage)(text, {
            encodeHtml: true,
            collapseNewLines: true,
        });
        if (!sanitized) {
            throw new common_1.BadRequestException('Le message est requis');
        }
        if (sanitized.length > message_sanitizer_1.DEFAULT_MESSAGE_MAX_LENGTH) {
            throw new common_1.BadRequestException('Le message est trop long (max 1000 caracteres)');
        }
        return sanitized;
    }
    validateSubject(subject) {
        if (!subject) {
            return null;
        }
        const sanitized = (0, message_sanitizer_1.sanitizeMessage)(subject, {
            encodeHtml: true,
            collapseNewLines: true,
        }).trim();
        if (!sanitized) {
            return null;
        }
        if (sanitized.length > MessageValidatorService_1.SUBJECT_MAX_LENGTH) {
            throw new common_1.BadRequestException(`Le sujet est trop long (max ${MessageValidatorService_1.SUBJECT_MAX_LENGTH} caracteres)`);
        }
        return sanitized;
    }
};
exports.MessageValidatorService = MessageValidatorService;
exports.MessageValidatorService = MessageValidatorService = MessageValidatorService_1 = __decorate([
    (0, common_1.Injectable)()
], MessageValidatorService);
//# sourceMappingURL=message-validator.service.js.map