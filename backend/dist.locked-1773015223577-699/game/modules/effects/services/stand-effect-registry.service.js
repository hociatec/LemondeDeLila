"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "StandEffectRegistryService", {
    enumerable: true,
    get: function() {
        return StandEffectRegistryService;
    }
});
const _common = require("@nestjs/common");
const _tileeffectregistryservice = require("./tile-effect-registry.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let StandEffectRegistryService = class StandEffectRegistryService {
    registerStand(type, handler) {
        this.tiles.register(type, (s, ctx)=>handler(s, ctx));
    }
    applyStand(type, state, ctx) {
        return this.tiles.apply(type, state, ctx);
    }
    constructor(tiles){
        this.tiles = tiles;
    }
};
StandEffectRegistryService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _tileeffectregistryservice.TileEffectRegistryService === "undefined" ? Object : _tileeffectregistryservice.TileEffectRegistryService
    ])
], StandEffectRegistryService);
