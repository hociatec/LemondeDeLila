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
exports.LamaBotService = void 0;
const common_1 = require("@nestjs/common");
const lama_model_1 = require("../model/lama.model");
const lama_shared_service_1 = require("../shared/lama-shared.service");
let LamaBotService = class LamaBotService {
    shared;
    constructor(shared) {
        this.shared = shared;
    }
    getBotActions(state, botPlayerId) {
        const current = state.turn?.currentPlayerId ?? null;
        if (current !== botPlayerId)
            return [];
        if (String(state.status ?? '').toLowerCase() !== 'started')
            return [];
        const meta = (state.metadata ?? {});
        if (meta.winnerId)
            return [];
        const step = meta.step ?? 'turn_choice';
        if (step === 'round_pause' || step === 'setup_config') {
            return [];
        }
        if (step === 'return_token') {
            if (meta.pendingReturnPlayerId !== botPlayerId)
                return [];
            const score = Number((meta.scoresByPlayerId ?? {})[String(botPlayerId)] ?? 0);
            if (score >= 10)
                return [{ type: 'lama_return', payload: { value: 10 } }];
            if (score >= 1)
                return [{ type: 'lama_return', payload: { value: 1 } }];
            return [{ type: 'lama_return', payload: { value: 0 } }];
        }
        if (meta.droppedOutByPlayerId?.[String(botPlayerId)]) {
            return [];
        }
        const turnIndex = Number(state.turnIndex ?? 0);
        const drawCount = this.shared.getCurrentTurnDrawCount(meta, botPlayerId, turnIndex);
        const maxDraws = this.shared.getMaxDrawsPerTurn(meta);
        const hand = (meta.handsByPlayerId ?? {})[String(botPlayerId)] ?? [];
        const discard = Array.isArray(meta.discard) ? meta.discard : [];
        const top = discard.length ? discard[discard.length - 1] : null;
        if (!top)
            return [];
        const drawLocked = Object.values(meta.droppedOutByPlayerId ?? {}).some((isOut) => Boolean(isOut));
        const canPlayValues = new Set([top, (0, lama_model_1.nextLamaValue)(top)]);
        const counts = new Map();
        for (const v of hand) {
            counts.set(v, (counts.get(v) ?? 0) + 1);
        }
        let best = null;
        for (const [value, count] of counts.entries()) {
            if (!canPlayValues.has(value))
                continue;
            if (!best || count > best.count) {
                best = { value, count };
            }
        }
        if (best) {
            return [{ type: 'lama_play', payload: { value: best.value, count: 1 } }];
        }
        if (drawCount >= maxDraws) {
            return [{ type: 'lama_quit', payload: {} }];
        }
        if (!drawLocked && (meta.deck ?? []).length > 0) {
            return [{ type: 'draw', payload: {} }];
        }
        return [{ type: 'lama_quit', payload: {} }];
    }
};
exports.LamaBotService = LamaBotService;
exports.LamaBotService = LamaBotService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [lama_shared_service_1.LamaSharedService])
], LamaBotService);
//# sourceMappingURL=lama-bot.service.js.map