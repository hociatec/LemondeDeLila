"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nextLamaValue = exports.lamaCardScore = exports.lamaCardLabel = exports.LAMA_VALUE = void 0;
exports.LAMA_VALUE = 7;
const lamaCardLabel = (v) => v === exports.LAMA_VALUE ? 'LAMA' : String(v);
exports.lamaCardLabel = lamaCardLabel;
const lamaCardScore = (v) => v === exports.LAMA_VALUE ? 10 : v;
exports.lamaCardScore = lamaCardScore;
const nextLamaValue = (top) => {
    if (top === 6)
        return exports.LAMA_VALUE;
    if (top === exports.LAMA_VALUE)
        return 1;
    return (top + 1);
};
exports.nextLamaValue = nextLamaValue;
//# sourceMappingURL=lama.model.js.map