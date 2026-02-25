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
exports.DeckPoliciesService = void 0;
const common_1 = require("@nestjs/common");
const random_service_1 = require("../../random/services/random.service");
let DeckPoliciesService = class DeckPoliciesService {
    random;
    constructor(random) {
        this.random = random;
    }
    drawFromPile(params) {
        let nextMeta = { ...(params.meta ?? {}) };
        let drawPile = Array.isArray(params.pile) ? [...params.pile] : [];
        let drawDiscard = Array.isArray(params.discard) ? [...params.discard] : [];
        let reshuffled = false;
        if (drawPile.length === 0 && drawDiscard.length > 0) {
            if (params.useWholeMetaRng) {
                const shuffled = this.random.shuffle(nextMeta, drawDiscard);
                nextMeta = { ...nextMeta, ...shuffled.meta };
                drawPile = shuffled.values;
            }
            else {
                const rngKey = (params.rngKey ?? 'rng');
                const shuffled = this.random.shuffle(nextMeta[rngKey] ?? {}, drawDiscard);
                nextMeta = { ...nextMeta, [rngKey]: shuffled.meta };
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
                reshuffled,
            };
        }
        const [card, ...rest] = drawPile;
        drawPile = rest;
        if (params.discardDrawnCard && card != null) {
            drawDiscard = [...drawDiscard, card];
        }
        return {
            meta: nextMeta,
            pile: drawPile,
            discard: drawDiscard,
            card: (card ?? null),
            reshuffled,
        };
    }
    drawOne(params) {
        const sourceMeta = params.meta ?? {};
        const out = this.drawFromPile({
            meta: sourceMeta,
            pile: Array.isArray(sourceMeta[params.deckKey])
                ? sourceMeta[params.deckKey]
                : [],
            discard: Array.isArray(sourceMeta[params.discardKey])
                ? sourceMeta[params.discardKey]
                : [],
            rngKey: params.rngKey,
            discardDrawnCard: false,
        });
        const updatedMeta = {
            ...out.meta,
            [params.deckKey]: out.pile,
            [params.discardKey]: out.discard,
        };
        return {
            meta: updatedMeta,
            card: out.card,
            reshuffled: out.reshuffled,
        };
    }
};
exports.DeckPoliciesService = DeckPoliciesService;
exports.DeckPoliciesService = DeckPoliciesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService])
], DeckPoliciesService);
//# sourceMappingURL=deck-policies.service.js.map