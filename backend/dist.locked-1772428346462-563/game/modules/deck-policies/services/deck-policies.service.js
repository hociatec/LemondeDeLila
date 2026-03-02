"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "DeckPoliciesService", {
    enumerable: true,
    get: function() {
        return DeckPoliciesService;
    }
});
const _common = require("@nestjs/common");
const _randomservice = require("../../random/services/random.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let DeckPoliciesService = class DeckPoliciesService {
    drawFromPile(params) {
        let nextMeta = {
            ...params.meta ?? {}
        };
        let drawPile = Array.isArray(params.pile) ? [
            ...params.pile
        ] : [];
        let drawDiscard = Array.isArray(params.discard) ? [
            ...params.discard
        ] : [];
        let reshuffled = false;
        if (drawPile.length === 0 && drawDiscard.length > 0) {
            if (params.useWholeMetaRng) {
                const shuffled = this.random.shuffle(nextMeta, drawDiscard);
                nextMeta = {
                    ...nextMeta,
                    ...shuffled.meta
                };
                drawPile = shuffled.values;
            } else {
                const rngKey = params.rngKey ?? 'rng';
                const shuffled = this.random.shuffle(nextMeta[rngKey] ?? {}, drawDiscard);
                nextMeta = {
                    ...nextMeta,
                    [rngKey]: shuffled.meta
                };
                drawPile = shuffled.values;
            }
            drawDiscard = [];
            reshuffled = true;
        }
        if (!drawPile.length) {
            return {
                meta: nextMeta,
                pile: drawPile,
                discard: drawDiscard,
                card: null,
                reshuffled
            };
        }
        const [card, ...rest] = drawPile;
        drawPile = rest;
        if (params.discardDrawnCard && card != null) {
            drawDiscard = [
                ...drawDiscard,
                card
            ];
        }
        return {
            meta: nextMeta,
            pile: drawPile,
            discard: drawDiscard,
            card: card ?? null,
            reshuffled
        };
    }
    drawOne(params) {
        const sourceMeta = params.meta ?? {};
        const out = this.drawFromPile({
            meta: sourceMeta,
            pile: Array.isArray(sourceMeta[params.deckKey]) ? sourceMeta[params.deckKey] : [],
            discard: Array.isArray(sourceMeta[params.discardKey]) ? sourceMeta[params.discardKey] : [],
            rngKey: params.rngKey,
            discardDrawnCard: false
        });
        const updatedMeta = {
            ...out.meta,
            [params.deckKey]: out.pile,
            [params.discardKey]: out.discard
        };
        return {
            meta: updatedMeta,
            card: out.card,
            reshuffled: out.reshuffled
        };
    }
    constructor(random){
        this.random = random;
    }
};
DeckPoliciesService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], DeckPoliciesService);
