"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PayloadValidationService = void 0;
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const common_1 = require("@nestjs/common");
let PayloadValidationService = class PayloadValidationService {
    validate(cls, payload) {
        const instance = (0, class_transformer_1.plainToInstance)(cls, payload ?? {}, {
            enableImplicitConversion: true,
        });
        const errors = (0, class_validator_1.validateSync)(instance, {
            whitelist: true,
            forbidNonWhitelisted: true,
            validationError: { target: false },
        });
        if (errors.length > 0) {
            const messages = errors
                .map((e) => Object.values(e.constraints ?? {}))
                .flat()
                .filter(Boolean);
            throw new common_1.BadRequestException(messages.join(', ') || 'Payload invalide');
        }
        return instance;
    }
};
exports.PayloadValidationService = PayloadValidationService;
exports.PayloadValidationService = PayloadValidationService = __decorate([
    (0, common_1.Injectable)()
], PayloadValidationService);
//# sourceMappingURL=payload-validation.service.js.map