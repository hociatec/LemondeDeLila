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
exports.ValidatedGameActionListDto = exports.ValidatedGameActionDto = exports.GameActionPayloadDto = void 0;
exports.validateAction = validateAction;
exports.validateActions = validateActions;
exports.sanitizeAction = sanitizeAction;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const game_errors_1 = require("../../../common/errors/game-errors");
class GameActionPayloadDto {
}
exports.GameActionPayloadDto = GameActionPayloadDto;
class ValidatedGameActionDto {
    type;
    payload;
    meta;
}
exports.ValidatedGameActionDto = ValidatedGameActionDto;
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({ message: 'Action type cannot be empty' }),
    (0, class_validator_1.Matches)(/^[a-z0-9_-]+$/i, {
        message: 'Action type must contain only alphanumeric characters, underscores, and hyphens',
    }),
    __metadata("design:type", String)
], ValidatedGameActionDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)({ message: 'Payload must be an object' }),
    __metadata("design:type", Object)
], ValidatedGameActionDto.prototype, "payload", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)({ message: 'Meta must be an object' }),
    __metadata("design:type", Object)
], ValidatedGameActionDto.prototype, "meta", void 0);
class ValidatedGameActionListDto {
    actions;
}
exports.ValidatedGameActionListDto = ValidatedGameActionListDto;
__decorate([
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ValidatedGameActionDto),
    __metadata("design:type", Array)
], ValidatedGameActionListDto.prototype, "actions", void 0);
async function validateAction(action, context = {}) {
    const dto = (0, class_transformer_1.plainToClass)(ValidatedGameActionDto, action);
    const errors = await (0, class_validator_1.validate)(dto, {
        whitelist: false,
        forbidNonWhitelisted: false,
        validationError: { target: false },
    });
    if (errors.length > 0) {
        const errorMessages = formatValidationErrors(errors);
        throw new game_errors_1.PayloadValidationError(`Action validation failed: ${errorMessages[0]}`, errorMessages, { ...context, action, timestamp: new Date() });
    }
    return dto;
}
async function validateActions(actions, context = {}) {
    if (!Array.isArray(actions)) {
        throw new game_errors_1.PayloadValidationError('Actions must be an array', ['Actions must be an array'], { ...context, actions, timestamp: new Date() });
    }
    const validated = [];
    const allErrors = [];
    for (let i = 0; i < actions.length; i++) {
        try {
            const validatedAction = await validateAction(actions[i], {
                ...context,
                actionIndex: i,
            });
            validated.push(validatedAction);
        }
        catch (error) {
            if (error instanceof game_errors_1.PayloadValidationError) {
                allErrors.push(`Action ${i}: ${error.message}`);
            }
            else {
                allErrors.push(`Action ${i}: Unknown validation error`);
            }
        }
    }
    if (allErrors.length > 0) {
        throw new game_errors_1.PayloadValidationError(`Actions validation failed: ${allErrors.length} error(s)`, allErrors, { ...context, actions, timestamp: new Date() });
    }
    return validated;
}
function formatValidationErrors(errors) {
    const messages = [];
    for (const error of errors) {
        if (error.constraints) {
            messages.push(...Object.values(error.constraints));
        }
        if (error.children && error.children.length > 0) {
            messages.push(...formatValidationErrors(error.children));
        }
    }
    return messages;
}
function sanitizeAction(action) {
    const sanitized = {
        type: String(action.type).trim().toLowerCase(),
    };
    if (action.payload && typeof action.payload === 'object') {
        sanitized.payload = sanitizePayload(action.payload);
    }
    if (action.meta && typeof action.meta === 'object') {
        sanitized.meta = sanitizePayload(action.meta);
    }
    return sanitized;
}
function sanitizePayload(payload, depth = 0) {
    const MAX_DEPTH = 5;
    const DANGEROUS_KEYS = ['__proto__', 'constructor', 'prototype'];
    if (depth > MAX_DEPTH) {
        return {};
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(payload)) {
        if (DANGEROUS_KEYS.includes(key)) {
            continue;
        }
        const sanitizedKey = String(key).trim();
        if (!sanitizedKey || sanitizedKey.length > 100) {
            continue;
        }
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            sanitized[sanitizedKey] = sanitizePayload(value, depth + 1);
        }
        else if (Array.isArray(value)) {
            const arrayValue = value;
            sanitized[sanitizedKey] = arrayValue
                .slice(0, 100)
                .map((item) => {
                if (item && typeof item === 'object') {
                    return sanitizePayload(item, depth + 1);
                }
                return item;
            });
        }
        else {
            sanitized[sanitizedKey] = value;
        }
    }
    return sanitized;
}
//# sourceMappingURL=validated-action.dto.js.map