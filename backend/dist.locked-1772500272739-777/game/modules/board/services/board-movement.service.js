"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "BoardMovementService", {
    enumerable: true,
    get: function() {
        return BoardMovementService;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let BoardMovementService = class BoardMovementService {
    moveCircular(length, current, steps) {
        if (length <= 0) return current;
        const next = ((current + steps) % length + length) % length;
        return next;
    }
    tileAt(tiles, position) {
        if (!tiles || tiles.length === 0) return undefined;
        const idx = (position % tiles.length + tiles.length) % tiles.length;
        return tiles[idx];
    }
};
BoardMovementService = _ts_decorate([
    (0, _common.Injectable)()
], BoardMovementService);
