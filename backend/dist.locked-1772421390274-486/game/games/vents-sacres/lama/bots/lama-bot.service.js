"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaBotService", {
    enumerable: true,
    get: function() {
        return LamaBotService;
    }
});
const _common = require("@nestjs/common");
const _lamamodel = require("../model/lama.model");
const _lamasharedservice = require("../shared/lama-shared.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let LamaBotService = class LamaBotService {
    getBotActions(state, botPlayerId) {
        const current = state.turn?.currentPlayerId ?? null;
        if (current !== botPlayerId) return [];
        if (String(state.status ?? '').toLowerCase() !== 'started') return [];
        const meta = state.metadata ?? {};
        if (meta.winnerId) return [];
        const step = meta.step ?? 'turn_choice';
        if (step === 'round_pause' || step === 'setup_config') {
            return [];
        }
        if (step === 'return_token') {
            if (meta.pendingReturnPlayerId !== botPlayerId) return [];
            const score = Number((meta.scoresByPlayerId ?? {})[String(botPlayerId)] ?? 0);
            if (score >= 10) return [
                {
                    type: 'lama_return',
                    payload: {
                        value: 10
                    }
                }
            ];
            if (score >= 1) return [
                {
                    type: 'lama_return',
                    payload: {
                        value: 1
                    }
                }
            ];
            return [
                {
                    type: 'lama_return',
                    payload: {
                        value: 0
                    }
                }
            ];
        }
        if (meta.droppedOutByPlayerId?.[String(botPlayerId)]) {
            return [];
        }
        const trackerRaw = meta?.turnTracker ?? null;
        const trackerPlayerId = this.shared.asNumberOrNull(trackerRaw?.playerId);
        const trackerDrawn = this.shared.asBoolean(trackerRaw?.drawn);
        const trackerPlayed = this.shared.asBoolean(trackerRaw?.played);
        const sameTurn = trackerPlayerId === botPlayerId;
        const turnIndex = Number(state.turnIndex ?? 0);
        const lastDrawMap = meta?.lastDrawTurnIndexByPlayerId ?? null;
        const lastDrawIndex = lastDrawMap && typeof lastDrawMap === 'object' ? this.shared.asNumberOrNull(lastDrawMap[String(botPlayerId)]) : null;
        const justDrew = lastDrawIndex != null && lastDrawIndex === turnIndex;
        const alreadyDrew = sameTurn && trackerDrawn || justDrew;
        const hand = (meta.handsByPlayerId ?? {})[String(botPlayerId)] ?? [];
        const discard = Array.isArray(meta.discard) ? meta.discard : [];
        const top = discard.length ? discard[discard.length - 1] : null;
        if (!top) return [];
        const drawLocked = !meta.allowDrawAfterFirstQuit && Object.values(meta.droppedOutByPlayerId ?? {}).some((isOut)=>Boolean(isOut));
        const canPlayValues = new Set([
            top,
            (0, _lamamodel.nextLamaValue)(top)
        ]);
        const counts = new Map();
        for (const v of hand){
            counts.set(v, (counts.get(v) ?? 0) + 1);
        }
        let best = null;
        for (const [value, count] of counts.entries()){
            if (!canPlayValues.has(value)) continue;
            if (!best || count > best.count) {
                best = {
                    value,
                    count
                };
            }
        }
        if (best) {
            return [
                {
                    type: 'lama_play',
                    payload: {
                        value: best.value,
                        count: 1
                    }
                }
            ];
        }
        if (alreadyDrew && !trackerPlayed) {
            return [
                {
                    type: 'lama_quit',
                    payload: {}
                }
            ];
        }
        if (!drawLocked && (meta.deck ?? []).length > 0) {
            return [
                {
                    type: 'draw',
                    payload: {}
                }
            ];
        }
        return [
            {
                type: 'lama_quit',
                payload: {}
            }
        ];
    }
    constructor(shared){
        this.shared = shared;
    }
};
LamaBotService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _lamasharedservice.LamaSharedService === "undefined" ? Object : _lamasharedservice.LamaSharedService
    ])
], LamaBotService);
