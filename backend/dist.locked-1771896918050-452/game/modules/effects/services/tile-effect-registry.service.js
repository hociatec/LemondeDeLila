"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TileEffectRegistryService = void 0;
const common_1 = require("@nestjs/common");
let TileEffectRegistryService = class TileEffectRegistryService {
    handlers = new Map();
    register(type, handler) {
        this.handlers.set(type, handler);
    }
    apply(type, state, context) {
        const handler = this.handlers.get(type);
        if (!handler) {
            return state;
        }
        return handler(state, context);
    }
};
exports.TileEffectRegistryService = TileEffectRegistryService;
exports.TileEffectRegistryService = TileEffectRegistryService = __decorate([
    (0, common_1.Injectable)()
], TileEffectRegistryService);
//# sourceMappingURL=tile-effect-registry.service.js.map