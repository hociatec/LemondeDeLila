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
exports.StandEffectRegistryService = void 0;
const common_1 = require("@nestjs/common");
const tile_effect_registry_service_1 = require("./tile-effect-registry.service");
let StandEffectRegistryService = class StandEffectRegistryService {
    tiles;
    constructor(tiles) {
        this.tiles = tiles;
    }
    registerStand(type, handler) {
        this.tiles.register(type, (s, ctx) => handler(s, ctx));
    }
    applyStand(type, state, ctx) {
        return this.tiles.apply(type, state, ctx);
    }
};
exports.StandEffectRegistryService = StandEffectRegistryService;
exports.StandEffectRegistryService = StandEffectRegistryService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tile_effect_registry_service_1.TileEffectRegistryService])
], StandEffectRegistryService);
//# sourceMappingURL=stand-effect-registry.service.js.map