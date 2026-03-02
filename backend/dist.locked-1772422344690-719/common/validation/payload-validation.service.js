"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PayloadValidationService", {
    enumerable: true,
    get: function() {
        return PayloadValidationService;
    }
});
const _classtransformer = require("class-transformer");
const _classvalidator = require("class-validator");
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let PayloadValidationService = class PayloadValidationService {
    validate(cls, payload) {
        const instance = (0, _classtransformer.plainToInstance)(cls, payload ?? {}, {
            enableImplicitConversion: true
        });
        const errors = (0, _classvalidator.validateSync)(instance, {
            whitelist: true,
            forbidNonWhitelisted: true,
            validationError: {
                target: false
            }
        });
        if (errors.length > 0) {
            const messages = errors.map((e)=>Object.values(e.constraints ?? {})).flat().filter(Boolean);
            throw new _common.BadRequestException(messages.join(', ') || 'Payload invalide');
        }
        return instance;
    }
};
PayloadValidationService = _ts_decorate([
    (0, _common.Injectable)()
], PayloadValidationService);
