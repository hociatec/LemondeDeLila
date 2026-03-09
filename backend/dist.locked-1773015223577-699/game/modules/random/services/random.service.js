"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "RandomService", {
    enumerable: true,
    get: function() {
        return RandomService;
    }
});
const _common = require("@nestjs/common");
const _seededrng = require("../../../../common/utils/seeded-rng");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let RandomService = class RandomService {
    createMetaRng(meta) {
        let current = meta;
        return {
            rng: ()=>{
                const out = this.nextFloat(current);
                current = out.meta;
                return out.value;
            },
            getMeta: ()=>current
        };
    }
    nextFloat(meta) {
        const out = (0, _seededrng.nextRngFloat)(meta);
        return {
            value: out.value,
            meta: out.meta
        };
    }
    nextInt(meta, maxExclusive) {
        const out = (0, _seededrng.nextRngInt)(meta, maxExclusive);
        return {
            value: out.value,
            meta: out.meta
        };
    }
    rollDice(meta, sides) {
        const safeSides = Math.max(1, Math.floor(sides));
        const out = this.nextInt(meta, safeSides);
        return {
            roll: out.value + 1,
            meta: out.meta
        };
    }
    pickIndex(meta, length) {
        const safeLen = Math.max(0, Math.floor(length));
        if (safeLen <= 0) return {
            index: 0,
            meta
        };
        const out = this.nextInt(meta, safeLen);
        return {
            index: out.value,
            meta: out.meta
        };
    }
    pickOne(meta, values) {
        const safe = Array.isArray(values) ? values : [];
        if (!safe.length) return {
            value: null,
            meta
        };
        const { index, meta: updated } = this.pickIndex(meta, safe.length);
        return {
            value: safe[index] ?? null,
            meta: updated
        };
    }
    shuffle(meta, values) {
        const copy = [
            ...Array.isArray(values) ? values : []
        ];
        let next = meta;
        for(let i = copy.length - 1; i > 0; i -= 1){
            const out = this.pickIndex(next, i + 1);
            next = out.meta;
            const j = out.index;
            [copy[i], copy[j]] = [
                copy[j],
                copy[i]
            ];
        }
        return {
            values: copy,
            meta: next
        };
    }
};
RandomService = _ts_decorate([
    (0, _common.Injectable)()
], RandomService);
