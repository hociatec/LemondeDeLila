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
    get GameActionPayloadDto () {
        return GameActionPayloadDto;
    },
    get ValidatedGameActionDto () {
        return ValidatedGameActionDto;
    },
    get ValidatedGameActionListDto () {
        return ValidatedGameActionListDto;
    },
    get sanitizeAction () {
        return sanitizeAction;
    },
    get validateAction () {
        return validateAction;
    },
    get validateActions () {
        return validateActions;
    }
});
const _classvalidator = require("class-validator");
const _classtransformer = require("class-transformer");
const _gameerrors = require("../../../common/errors/game-errors");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let GameActionPayloadDto = class GameActionPayloadDto {
};
let ValidatedGameActionDto = class ValidatedGameActionDto {
};
_ts_decorate([
    (0, _classvalidator.IsString)(),
    (0, _classvalidator.IsNotEmpty)({
        message: 'Action type cannot be empty'
    }),
    (0, _classvalidator.Matches)(/^[a-z0-9_-]+$/i, {
        message: 'Action type must contain only alphanumeric characters, underscores, and hyphens'
    }),
    _ts_metadata("design:type", String)
], ValidatedGameActionDto.prototype, "type", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsObject)({
        message: 'Payload must be an object'
    }),
    _ts_metadata("design:type", typeof Record === "undefined" ? Object : Record)
], ValidatedGameActionDto.prototype, "payload", void 0);
_ts_decorate([
    (0, _classvalidator.IsOptional)(),
    (0, _classvalidator.IsObject)({
        message: 'Meta must be an object'
    }),
    _ts_metadata("design:type", typeof Record === "undefined" ? Object : Record)
], ValidatedGameActionDto.prototype, "meta", void 0);
let ValidatedGameActionListDto = class ValidatedGameActionListDto {
};
_ts_decorate([
    (0, _classvalidator.ValidateNested)({
        each: true
    }),
    (0, _classtransformer.Type)(()=>ValidatedGameActionDto),
    _ts_metadata("design:type", Array)
], ValidatedGameActionListDto.prototype, "actions", void 0);
async function validateAction(action, context = {}) {
    const dto = (0, _classtransformer.plainToClass)(ValidatedGameActionDto, action);
    const errors = await (0, _classvalidator.validate)(dto, {
        whitelist: false,
        forbidNonWhitelisted: false,
        validationError: {
            target: false
        }
    });
    if (errors.length > 0) {
        const errorMessages = formatValidationErrors(errors);
        throw new _gameerrors.PayloadValidationError(`Action validation failed: ${errorMessages[0]}`, errorMessages, {
            ...context,
            action,
            timestamp: new Date()
        });
    }
    return dto;
}
async function validateActions(actions, context = {}) {
    if (!Array.isArray(actions)) {
        throw new _gameerrors.PayloadValidationError('Actions must be an array', [
            'Actions must be an array'
        ], {
            ...context,
            actions,
            timestamp: new Date()
        });
    }
    const validated = [];
    const allErrors = [];
    for(let i = 0; i < actions.length; i++){
        try {
            const validatedAction = await validateAction(actions[i], {
                ...context,
                actionIndex: i
            });
            validated.push(validatedAction);
        } catch (error) {
            if (error instanceof _gameerrors.PayloadValidationError) {
                allErrors.push(`Action ${i}: ${error.message}`);
            } else {
                allErrors.push(`Action ${i}: Unknown validation error`);
            }
        }
    }
    if (allErrors.length > 0) {
        throw new _gameerrors.PayloadValidationError(`Actions validation failed: ${allErrors.length} error(s)`, allErrors, {
            ...context,
            actions,
            timestamp: new Date()
        });
    }
    return validated;
}
/**
 * Formats validation errors into readable messages
 */ function formatValidationErrors(errors) {
    const messages = [];
    for (const error of errors){
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
        type: String(action.type).trim().toLowerCase()
    };
    if (action.payload && typeof action.payload === 'object') {
        sanitized.payload = sanitizePayload(action.payload);
    }
    if (action.meta && typeof action.meta === 'object') {
        sanitized.meta = sanitizePayload(action.meta);
    }
    return sanitized;
}
/**
 * Sanitizes a payload object by removing dangerous properties and limiting depth
 */ function sanitizePayload(payload, depth = 0) {
    const MAX_DEPTH = 5;
    const DANGEROUS_KEYS = [
        '__proto__',
        'constructor',
        'prototype'
    ];
    if (depth > MAX_DEPTH) {
        return {};
    }
    const sanitized = {};
    for (const [key, value] of Object.entries(payload)){
        // Skip dangerous keys
        if (DANGEROUS_KEYS.includes(key)) {
            continue;
        }
        // Sanitize string keys
        const sanitizedKey = String(key).trim();
        if (!sanitizedKey || sanitizedKey.length > 100) {
            continue;
        }
        // Recursively sanitize nested objects
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            sanitized[sanitizedKey] = sanitizePayload(value, depth + 1);
        } else if (Array.isArray(value)) {
            // Limit array length
            const arrayValue = value;
            sanitized[sanitizedKey] = arrayValue.slice(0, 100).map((item)=>{
                if (item && typeof item === 'object') {
                    return sanitizePayload(item, depth + 1);
                }
                return item;
            });
        } else {
            // Primitive values are safe
            sanitized[sanitizedKey] = value;
        }
    }
    return sanitized;
}
