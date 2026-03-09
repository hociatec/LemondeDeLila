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
    get getRngMeta () {
        return getRngMeta;
    },
    get getSafePlayers () {
        return getSafePlayers;
    }
});
function getSafePlayers(baseState) {
    return Array.isArray(baseState.players) ? baseState.players : [];
}
function getRngMeta(metadata) {
    return metadata?.rng ?? {};
}
