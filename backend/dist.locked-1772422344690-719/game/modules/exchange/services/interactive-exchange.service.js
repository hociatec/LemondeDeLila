"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "InteractiveExchangeService", {
    enumerable: true,
    get: function() {
        return InteractiveExchangeService;
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
let InteractiveExchangeService = class InteractiveExchangeService {
    start(state, playerId, card, adapter) {
        if (state.pending) {
            return {
                kind: 'blocked',
                state
            };
        }
        const giveChoices = adapter.getInventory(state, playerId);
        if (!Array.isArray(giveChoices) || giveChoices.length === 0) {
            return {
                kind: 'no_inventory',
                state
            };
        }
        const targets = adapter.listTargets(state, playerId);
        if (!Array.isArray(targets) || targets.length === 0) {
            return {
                kind: 'no_targets',
                state
            };
        }
        const pending = {
            type: 'exchange',
            playerId,
            card,
            step: 'choose_target',
            blocking: true,
            label: "Choisissez un joueur pour l'échange dans la liste, puis Entrée.",
            targets
        };
        return {
            kind: 'started',
            state: {
                ...state,
                pending: pending
            },
            pending
        };
    }
    chooseTarget(state, playerId, targetPlayerId, adapter) {
        const pending = state.pending;
        if (!pending || pending.type !== 'exchange') return {
            kind: 'invalid',
            state
        };
        if (pending.playerId !== playerId) return {
            kind: 'invalid',
            state
        };
        if (pending.step !== 'choose_target') return {
            kind: 'invalid',
            state
        };
        const targets = Array.isArray(pending.targets) ? pending.targets : [];
        const chosen = targets.find((t)=>t.targetPlayerId === targetPlayerId) ?? null;
        if (!chosen) return {
            kind: 'invalid',
            state
        };
        const giveChoices = adapter.getInventory(state, playerId);
        if (!Array.isArray(giveChoices) || giveChoices.length === 0) {
            return {
                kind: 'invalid',
                state
            };
        }
        const nextPending = {
            ...pending,
            step: 'choose_give',
            blocking: true,
            targetPlayerId: chosen.targetPlayerId,
            targetUsername: chosen.targetUsername,
            giveChoices,
            label: 'Choisissez la carte à donner dans la liste, puis Entrée.'
        };
        return {
            kind: 'updated',
            state: {
                ...state,
                pending: nextPending
            },
            pending: nextPending
        };
    }
    chooseGive(state, playerId, give, adapter) {
        const pending = state.pending;
        if (!pending || pending.type !== 'exchange') return {
            kind: 'invalid',
            state
        };
        if (pending.playerId !== playerId) return {
            kind: 'invalid',
            state
        };
        if (pending.step !== 'choose_give') return {
            kind: 'invalid',
            state
        };
        const targetPlayerId = typeof pending.targetPlayerId === 'number' ? pending.targetPlayerId : null;
        if (typeof targetPlayerId !== 'number') return {
            kind: 'invalid',
            state
        };
        const giveCard = (give ?? '').trim();
        if (!giveCard) return {
            kind: 'invalid',
            state
        };
        const currentInv = adapter.getInventory(state, playerId);
        if (!Array.isArray(currentInv) || !currentInv.includes(giveCard)) {
            return {
                kind: 'invalid',
                state
            };
        }
        const targetInv = adapter.getInventory(state, targetPlayerId);
        const targetCards = Array.isArray(targetInv) ? targetInv : [];
        const targetHadCards = targetCards.length > 0;
        const picked = targetHadCards ? this.pickRandomFromArray(state, targetCards) : {
            card: null,
            state
        };
        const initiator = (state.players ?? []).find((p)=>p.id === playerId);
        const target = (state.players ?? []).find((p)=>p.id === targetPlayerId);
        const offer = {
            type: 'exchange',
            step: 'confirm',
            blocking: true,
            label: 'Échange proposé : A = accepter, R = refuser.',
            playerId: targetPlayerId,
            initiatorPlayerId: playerId,
            initiatorUsername: typeof initiator?.username === 'string' && initiator.username.trim() ? initiator.username.trim() : `Joueur ${playerId}`,
            targetPlayerId,
            targetUsername: typeof target?.username === 'string' && target.username.trim() ? target.username.trim() : `Joueur ${targetPlayerId}`,
            give: giveCard,
            take: targetHadCards ? picked.card : null,
            targetHadCards,
            bonusRequested: !targetHadCards
        };
        return {
            kind: 'offered',
            state: {
                ...picked.state,
                pending: offer
            },
            offer
        };
    // Si la cible a des cartes: elle en rend une au hasard.
    // (legacy code removed)
    // Sinon: pénalité + bonus (géré par le jeu).
    // (legacy code removed)
    }
    acceptOffer(state, targetPlayerId, adapter) {
        const pending = state.pending;
        if (!pending || pending.type !== 'exchange' || pending.step !== 'confirm') {
            return {
                kind: 'invalid',
                state
            };
        }
        if (pending.playerId !== targetPlayerId) return {
            kind: 'invalid',
            state
        };
        const offer = pending;
        const initiatorId = offer.initiatorPlayerId;
        const give = (offer.give ?? '').trim();
        const take = offer.take != null ? String(offer.take).trim() : null;
        const initiatorInv = adapter.getInventory(state, initiatorId);
        if (!Array.isArray(initiatorInv) || !initiatorInv.includes(give)) {
            return {
                kind: 'invalid',
                state: {
                    ...state,
                    pending: null
                }
            };
        }
        let next = state;
        next = adapter.removeFromInventory(next, initiatorId, give);
        next = adapter.addCardToPlayer(next, targetPlayerId, give);
        if (take) {
            const targetInv = adapter.getInventory(next, targetPlayerId);
            if (Array.isArray(targetInv) && targetInv.includes(take)) {
                next = adapter.removeFromInventory(next, targetPlayerId, take);
                next = adapter.addCardToPlayer(next, initiatorId, take);
            }
        } else if (adapter.setSkipTurns) {
            next = adapter.setSkipTurns(next, targetPlayerId, 2);
        }
        return {
            kind: 'resolved',
            state: {
                ...next,
                pending: null
            },
            offer
        };
    }
    refuseOffer(state, targetPlayerId) {
        const pending = state.pending;
        if (!pending || pending.type !== 'exchange' || pending.step !== 'confirm') {
            return state;
        }
        if (pending.playerId !== targetPlayerId) return state;
        return {
            ...state,
            pending: null
        };
    }
    pickRandomFromArray(state, values) {
        const meta = state.metadata ?? {};
        const { index: idx, meta: updated } = this.random.pickIndex(meta, values.length);
        const index = Math.max(0, Math.min(values.length - 1, idx));
        return {
            card: values[index] ?? '',
            state: {
                ...state,
                metadata: updated
            }
        };
    }
    constructor(random){
        this.random = random;
    }
};
InteractiveExchangeService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], InteractiveExchangeService);
