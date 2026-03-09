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
    get LAMA_VALUE () {
        return LAMA_VALUE;
    },
    get lamaCardLabel () {
        return lamaCardLabel;
    },
    get lamaCardScore () {
        return lamaCardScore;
    },
    get nextLamaValue () {
        return nextLamaValue;
    }
});
const LAMA_VALUE = 7;
const lamaCardLabel = (v)=>v === LAMA_VALUE ? 'LAMA' : String(v);
const lamaCardScore = (v)=>v === LAMA_VALUE ? 10 : v;
const nextLamaValue = (top)=>{
    if (top === 6) return LAMA_VALUE;
    if (top === LAMA_VALUE) return 1;
    return top + 1;
};
