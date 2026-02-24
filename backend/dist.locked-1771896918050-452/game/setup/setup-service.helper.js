"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSafePlayers = getSafePlayers;
exports.getRngMeta = getRngMeta;
function getSafePlayers(baseState) {
    return Array.isArray(baseState.players) ? baseState.players : [];
}
function getRngMeta(metadata) {
    return metadata?.rng ?? {};
}
//# sourceMappingURL=setup-service.helper.js.map