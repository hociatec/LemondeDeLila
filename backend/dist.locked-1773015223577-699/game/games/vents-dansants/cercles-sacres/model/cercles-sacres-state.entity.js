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
    get CERCLES_SACRES_GOAL () {
        return CERCLES_SACRES_GOAL;
    },
    get CERCLES_SACRES_HAND_LIMIT () {
        return CERCLES_SACRES_HAND_LIMIT;
    },
    get CERCLES_SACRES_HAND_MIN () {
        return CERCLES_SACRES_HAND_MIN;
    }
});
const CERCLES_SACRES_GOAL = 3;
const CERCLES_SACRES_HAND_MIN = 6;
const CERCLES_SACRES_HAND_LIMIT = 8;
