"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SacAMalicesActionService", {
    enumerable: true,
    get: function() {
        return SacAMalicesActionService;
    }
});
const _common = require("@nestjs/common");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _deckpoliciesservice = require("../../../../modules/deck-policies/services/deck-policies.service");
const _sacamalicessetupservice = require("../setup/sac-a-malices-setup.service");
const _sacamalicesvariants = require("../sac-a-malices-variants");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
function toStringValue(value) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
function toNumberValue(value) {
    const candidate = typeof value === 'number' ? value : typeof value === 'string' && value.trim().length ? Number(value.trim()) : NaN;
    return Number.isFinite(candidate) ? candidate : null;
}
function getHouseCost(group, level) {
    if (!group) return 0;
    const levelKey = String(clamp(level, 1, 4));
    const perLevel = group.housePrices?.[levelKey];
    if (Number.isFinite(perLevel ?? NaN)) return Number(perLevel);
    return group.housePrice ?? 0;
}
let SacAMalicesActionService = class SacAMalicesActionService {
    applyActions(state, actions) {
        const next = (0, _actionservicehelper.applyActionsSequentially)(state, actions, (next, action)=>{
            const type = (0, _actionservicehelper.normalizeActionType)(action);
            return (0, _actionservicehelper.dispatchByActionType)(type, {
                sac_set_variant: ()=>{
                    next = this.applyVariantConfig(next, action);
                    return next;
                },
                roll: ()=>{
                    next = this.handleRoll(next);
                    return next;
                },
                buy: ()=>{
                    next = this.handleBuy(next, true);
                    return next;
                },
                skip_buy: ()=>{
                    next = this.handleBuy(next, false);
                    return next;
                },
                build: ()=>{
                    next = this.openChooseProperty(next, 'build');
                    return next;
                },
                sell_building: ()=>{
                    next = this.openChooseProperty(next, 'sell_building');
                    return next;
                },
                mortgage: ()=>{
                    next = this.openChooseProperty(next, 'mortgage');
                    return next;
                },
                unmortgage: ()=>{
                    next = this.openChooseProperty(next, 'unmortgage');
                    return next;
                },
                choose_property: ()=>{
                    next = this.handleChooseProperty(next, action);
                    return next;
                },
                pay_fine: ()=>{
                    next = this.handlePayFine(next);
                    return next;
                },
                use_jail_card: ()=>{
                    next = this.handleUseJailCard(next);
                    return next;
                }
            }, ()=>next);
        });
        return next;
    }
    applyVariantConfig(state, action) {
        const meta = this.getMeta(state);
        if (meta.setupStep !== 'setup_config') return state;
        const payload = asRecord(action?.payload);
        const candidateVariant = toStringValue(payload.variant ?? payload.variantId ?? payload.value) ?? toStringValue(meta.variantId);
        const parsedCandidate = (0, _sacamalicesvariants.parseVariantInput)(candidateVariant ?? null);
        const parsed = parsedCandidate ?? 'classic';
        const variant = _sacamalicesvariants.SAC_VARIANT_BY_ID[parsed] ?? _sacamalicesvariants.SAC_VARIANT_BY_ID['classic'];
        const chosenId = variant?.id ?? 'classic';
        let next = this.setup.applyVariantSelection(state, chosenId);
        const actionMeta = asRecord(action.meta);
        const actorId = toNumberValue(actionMeta.actorId);
        const label = variant?.label ?? chosenId;
        if (!parsedCandidate) {
            next = this.core.appendLog(next, `Variante inconnue, défaut "${label}".`);
        } else if (actorId != null) {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, actorId)} choisit la variante : ${label}.`);
        } else {
            next = this.core.appendLog(next, `Variante choisie : ${label}.`);
        }
        return next;
    }
    handleRoll(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        if (state.pending) return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        let meta = this.getMeta(state);
        if (meta.statuses?.eliminated?.[currentId]) {
            return this.advanceTurn(state);
        }
        const rules = this.getRules(meta);
        // Prison
        const jailTurns = meta.statuses?.inJail?.[currentId] ?? 0;
        if (jailTurns > 0) {
            if (rules.jail.allowDoubleEscape) {
                // 2d6 : si double => sortie immédiate et déplacement ; sinon on attend.
                const r1 = this.random.rollDice(meta, 6);
                const r2 = this.random.rollDice(r1.meta, 6);
                meta = {
                    ...meta,
                    ...r2.meta
                };
                const d1 = r1.roll;
                const d2 = r2.roll;
                const sum = d1 + d2;
                const isDouble = d1 === d2;
                let next = {
                    ...state,
                    lastRoll: sum,
                    metadata: {
                        ...state.metadata ?? {},
                        ...meta
                    }
                };
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} lance les dés : "${d1}" + "${d2}" = "${sum}".`);
                if (!isDouble) {
                    const remainingTurns = Math.max(0, jailTurns - 1);
                    next = this.setJailTurns(next, currentId, remainingTurns);
                    if (remainingTurns <= 0) {
                        if (rules.jail.autoFine > 0) {
                            next = this.core.appendLog(next, `Sortie automatique : amende ${rules.jail.autoFine} €.`);
                            next = this.addMoney(next, currentId, -rules.jail.autoFine, {
                                toPot: true
                            });
                        } else {
                            next = this.core.appendLog(next, 'Sortie automatique.');
                        }
                        next = this.setJailTurns(next, currentId, 0);
                    } else {
                        next = this.core.appendLog(next, `Prison : il reste ${remainingTurns} tour(s).`);
                    }
                    next = this.checkWinner(next);
                    if (this.getMeta(next).winnerId != null) return {
                        ...next,
                        status: 'finished'
                    };
                    return this.advanceTurn(next);
                }
                next = this.core.appendLog(next, 'Double : vous sortez de prison.');
                next = this.setJailTurns(next, currentId, 0);
                next = this.setConsecutiveDoubles(next, currentId, 0);
                // On rejoue / on se déplace normalement après la sortie.
                next = this.moveForward(next, currentId, sum);
                next = this.applyLanding(next, currentId);
                next = this.checkWinner(next);
                if (this.getMeta(next).winnerId != null) return {
                    ...next,
                    status: 'finished'
                };
                if (next.pending) {
                    next = this.setExtraRoll(next, currentId, true);
                    return next;
                }
                next = this.core.appendLog(next, 'Double : vous rejouez.');
                next = this.setExtraRoll(next, currentId, true);
                return next;
            }
            // Version "attente" : on attend N tours, puis amende auto (si configurée).
            let next = this.setJailTurns(state, currentId, Math.max(0, jailTurns - 1));
            const remaining = this.getMeta(next).statuses?.inJail?.[currentId] ?? 0;
            if (remaining <= 0) {
                if (rules.jail.autoFine > 0) {
                    next = this.core.appendLog(next, `Sortie automatique : amende ${rules.jail.autoFine} €.`);
                    next = this.addMoney(next, currentId, -rules.jail.autoFine, {
                        toPot: true
                    });
                } else {
                    next = this.core.appendLog(next, 'Sortie automatique.');
                }
            } else {
                next = this.core.appendLog(next, `Prison : il reste ${remaining} tour(s).`);
            }
            next = this.checkWinner(next);
            if (this.getMeta(next).winnerId != null) return {
                ...next,
                status: 'finished'
            };
            return this.advanceTurn(next);
        }
        // On consomme l'éventuel bonus "rejouer" à l'entrée du lancer.
        state = this.setExtraRoll(state, currentId, false);
        meta = this.getMeta(state);
        // 2d6
        const r1 = this.random.rollDice(meta, 6);
        const r2 = this.random.rollDice(r1.meta, 6);
        meta = {
            ...meta,
            ...r2.meta
        };
        const d1 = r1.roll;
        const d2 = r2.roll;
        const sum = d1 + d2;
        const isDouble = d1 === d2;
        let next = {
            ...state,
            lastRoll: sum,
            metadata: {
                ...state.metadata ?? {},
                ...meta
            }
        };
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} lance les dés : "${d1}" + "${d2}" = "${sum}".`);
        // Doubles : rejouer, 3 doubles consécutifs => prison.
        const prevDoubles = this.getMeta(next).statuses?.consecutiveDoubles?.[currentId] ?? 0;
        const doubles = isDouble ? prevDoubles + 1 : 0;
        next = this.setConsecutiveDoubles(next, currentId, doubles);
        if (doubles >= 3) {
            next = this.core.appendLog(next, 'Trois doubles : direction la prison.');
            next = this.sendToJail(next, currentId);
            next = this.setConsecutiveDoubles(next, currentId, 0);
            next = this.setExtraRoll(next, currentId, false);
            next = this.checkWinner(next);
            if (this.getMeta(next).winnerId != null) return {
                ...next,
                status: 'finished'
            };
            return this.advanceTurn(next);
        }
        meta = this.getMeta(next);
        if (meta.statuses?.eliminated?.[currentId]) {
            next = this.checkWinner(next);
            if (this.getMeta(next).winnerId != null) return {
                ...next,
                status: 'finished'
            };
            return this.advanceTurn(next);
        }
        // (prison gérée avant le lancer)
        // Déplacement
        next = this.moveForward(next, currentId, sum);
        next = this.applyLanding(next, currentId);
        next = this.checkWinner(next);
        if (this.getMeta(next).winnerId != null) return {
            ...next,
            status: 'finished'
        };
        if (next.pending) {
            if (isDouble) {
                next = this.setExtraRoll(next, currentId, true);
            }
            return next;
        }
        if (isDouble) {
            next = this.core.appendLog(next, 'Double : vous rejouez.');
            next = this.setExtraRoll(next, currentId, true);
            return next;
        }
        return this.advanceTurn(next);
    }
    handleBuy(state, accept) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        const pending = state.pending;
        const pendingRow = asRecord(pending);
        if (!pending || pendingRow.type !== 'buy') return state;
        const playerId = typeof pendingRow.playerId === 'number' ? pendingRow.playerId : state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        const pendingData = asRecord(pendingRow.data);
        const tileIndex = toNumberValue(pendingData.tileIndex);
        if (tileIndex == null) return state;
        if (!Number.isFinite(tileIndex)) return state;
        let next = {
            ...state,
            pending: null
        };
        if (!accept) {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} n'achète pas.`);
            next = this.checkWinner(next);
            if (this.getMeta(next).winnerId != null) return {
                ...next,
                status: 'finished'
            };
            return this.advanceTurnOrExtraRoll(next, playerId);
        }
        const meta = this.getMeta(next);
        const tile = meta.tiles?.[tileIndex];
        if (!tile) return this.advanceTurnOrExtraRoll(next, playerId);
        if (meta.ownership?.[tileIndex] != null) {
            next = this.core.appendLog(next, 'Déjà acheté.');
            return this.advanceTurnOrExtraRoll(next, playerId);
        }
        const price = this.getPurchasePrice(meta, tile);
        if (price <= 0) {
            next = this.core.appendLog(next, 'Achat impossible (prix inconnu).');
            return this.advanceTurnOrExtraRoll(next, playerId);
        }
        const cash = meta.money?.[playerId] ?? 0;
        if (cash < price) {
            next = this.core.appendLog(next, 'Fonds insuffisants.');
            return this.advanceTurnOrExtraRoll(next, playerId);
        }
        next = this.addMoney(next, playerId, -price, {
            toPot: false
        });
        next = this.setOwner(next, tileIndex, playerId);
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} achète "${tile.title}" pour ${price} €.`);
        next = this.checkWinner(next);
        if (this.getMeta(next).winnerId != null) return {
            ...next,
            status: 'finished'
        };
        return this.advanceTurnOrExtraRoll(next, playerId);
    }
    handlePayFine(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        if (state.pending) return state;
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        const meta = this.getMeta(state);
        const rules = this.getRules(meta);
        if (!rules.jail.allowPayFine || rules.jail.autoFine <= 0) {
            return this.core.appendLog(state, 'Sortie de prison par amende : indisponible dans cette variante.');
        }
        const jailTurns = meta.statuses?.inJail?.[playerId] ?? 0;
        if (jailTurns <= 0) return state;
        let next = state;
        next = this.core.appendLog(next, `Prison : vous payez ${rules.jail.autoFine} € pour sortir.`);
        next = this.addMoney(next, playerId, -rules.jail.autoFine, {
            toPot: true
        });
        next = this.setJailTurns(next, playerId, 0);
        next = this.checkWinner(next);
        if (this.getMeta(next).winnerId != null) return {
            ...next,
            status: 'finished'
        };
        return next;
    }
    handleUseJailCard(state) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        if (state.pending) return state;
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        const meta = this.getMeta(state);
        const jailTurns = meta.statuses?.inJail?.[playerId] ?? 0;
        if (jailTurns <= 0) return state;
        const count = meta.statuses?.getOutOfJail?.[playerId] ?? 0;
        if (count <= 0) {
            return this.core.appendLog(state, 'Vous n’avez pas de carte "Sortie de prison".');
        }
        let next = state;
        next = this.core.appendLog(next, 'Carte "Sortie de prison" utilisée.');
        next = this.setGetOutOfJail(next, playerId, count - 1);
        next = this.setJailTurns(next, playerId, 0);
        return next;
    }
    openChooseProperty(state, kind) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        if (state.pending) return state;
        const playerId = state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        const meta = this.getMeta(state);
        const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
        const myCash = meta.money?.[playerId] ?? 0;
        const options = [];
        for(let tileIndex = 0; tileIndex < tiles.length; tileIndex += 1){
            const tile = tiles[tileIndex];
            if (!tile) continue;
            if (meta.ownership?.[tileIndex] !== playerId) continue;
            const b = this.getBuilding(meta, tileIndex);
            if (kind === 'build') {
                if (tile.type !== 'property') continue;
                if (b.mortgaged || b.hotel) continue;
                const group = this.getGroup(meta, tile.group ?? '');
                if (!group) continue;
                if (!this.isGroupComplete(meta, playerId, group)) continue;
                const supportsHotel = Number(group?.hotelPrice ?? 0) > 0 && Number(group?.rents?.hotel ?? 0) > 0;
                if (!supportsHotel && b.houses >= 4) continue;
                const nextLevel = clamp(b.houses + 1, 1, 4);
                const houseCost = getHouseCost(group, nextLevel);
                const cost = supportsHotel && b.houses >= 4 ? Number(group.hotelPrice ?? 0) || 0 : houseCost;
                if (!Number.isFinite(cost) || cost <= 0 || myCash < cost) continue;
                options.push({
                    tileIndex,
                    label: `${tile.title} (coût ${cost} €)`
                });
                continue;
            }
            if (kind === 'sell_building') {
                if (tile.type !== 'property') continue;
                if (!b.hotel && b.houses <= 0) continue;
                const group = this.getGroup(meta, tile.group ?? '');
                const supportsHotel = Number(group?.hotelPrice ?? 0) > 0 && Number(group?.rents?.hotel ?? 0) > 0;
                const refund = (()=>{
                    if (!group) return 0;
                    if (supportsHotel && b.hotel) return Math.floor((Number(group.hotelPrice ?? 0) || 0) / 2);
                    const level = clamp(b.houses, 1, 4);
                    const cost = getHouseCost(group, level);
                    return Math.floor(cost / 2);
                })();
                options.push({
                    tileIndex,
                    label: `${tile.title} (remb. ${refund} €)`
                });
                continue;
            }
            if (kind === 'mortgage') {
                if (b.mortgaged) continue;
                if (tile.type === 'property' && (b.hotel || b.houses > 0)) continue;
                const amount = this.getMortgageValue(meta, tile);
                if (!Number.isFinite(amount) || amount <= 0) continue;
                options.push({
                    tileIndex,
                    label: `${tile.title} (+${amount} €)`
                });
                continue;
            }
            if (kind === 'unmortgage') {
                if (!b.mortgaged) continue;
                const cost = this.getUnmortgageCost(meta, tile);
                if (!Number.isFinite(cost) || cost <= 0 || myCash < cost) continue;
                options.push({
                    tileIndex,
                    label: `${tile.title} (-${cost} €)`
                });
            }
        }
        if (!options.length) {
            return this.core.appendLog(state, 'Aucune propriété disponible pour cette action.');
        }
        const pending = {
            type: 'choose_property',
            playerId,
            blocking: true,
            label: kind === 'build' ? 'Construire où ?' : kind === 'sell_building' ? 'Vendre une habitation où ?' : kind === 'mortgage' ? 'Hypothéquer quoi ?' : 'Lever l’hypothèque de quoi ?',
            choices: options.map((o)=>o.label),
            data: {
                kind,
                options: options.map((o)=>({
                        tileIndex: o.tileIndex
                    }))
            }
        };
        return {
            ...state,
            pending
        };
    }
    handleChooseProperty(state, action) {
        if (String(state.status ?? '').toLowerCase() !== 'started') return state;
        const pending = state.pending;
        const pendingRow = asRecord(pending);
        if (!pending || pendingRow.type !== 'choose_property') return state;
        const playerId = typeof pendingRow.playerId === 'number' ? pendingRow.playerId : state.turn?.currentPlayerId ?? null;
        if (playerId == null) return state;
        const payload = asRecord(action.payload);
        const wanted = toNumberValue(payload.tileIndex);
        const data = asRecord(pendingRow.data);
        const options = Array.isArray(data.options) ? data.options : [];
        if (wanted == null) return state;
        if (!options.some((o)=>o.tileIndex === wanted)) return state;
        const kind = toStringValue(data.kind) ?? '';
        let next = {
            ...state,
            pending: null
        };
        const meta = this.getMeta(next);
        const tile = meta.tiles?.[wanted];
        if (!tile) return next;
        if (meta.ownership?.[wanted] !== playerId) return next;
        if (kind === 'build') {
            next = this.buildOne(next, playerId, wanted);
        } else if (kind === 'sell_building') {
            next = this.sellOne(next, playerId, wanted);
        } else if (kind === 'mortgage') {
            next = this.mortgageTile(next, playerId, wanted);
        } else if (kind === 'unmortgage') {
            next = this.unmortgageTile(next, playerId, wanted);
        }
        next = this.checkWinner(next);
        if (this.getMeta(next).winnerId != null) return {
            ...next,
            status: 'finished'
        };
        return next;
    }
    applyLanding(state, playerId) {
        let next = state;
        const meta = this.getMeta(next);
        const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
        const pos = meta.positions?.[playerId] ?? 0;
        const tile = tiles[pos];
        if (!tile) return next;
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} place ${this.pawnLabel(next, playerId)} en case ${pos + 1} (${tile.title}).`);
        if (tile.description && String(tile.description).trim()) {
            next = this.core.appendLog(next, String(tile.description).trim());
        }
        if (tile.type === 'go_to_jail') {
            next = this.core.appendLog(next, 'Direction la prison.');
            return this.sendToJail(next, playerId);
        }
        if (tile.type === 'free') {
            const rules = this.getRules(this.getMeta(next));
            if (!rules.potEnabled) {
                return this.core.appendLog(next, 'Parking : rien ne se passe.');
            }
            const pot = this.getMeta(next).pot ?? 0;
            if (pot > 0) {
                next = this.core.appendLog(next, `Parc Gratuit : vous récupérez ${pot} €.`);
                next = this.setPot(next, 0);
                next = this.addMoney(next, playerId, pot, {
                    toPot: false
                });
            } else {
                next = this.core.appendLog(next, 'Parc Gratuit : pot vide.');
            }
            return next;
        }
        if (tile.type === 'tax') {
            const amount = extractEuroAmount(`${tile.title} ${tile.description ?? ''}`);
            if (amount > 0) {
                next = this.core.appendLog(next, `Taxe : ${amount} €.`);
                next = this.addMoney(next, playerId, -amount, {
                    toPot: true
                });
            }
            return next;
        }
        if (tile.type === 'chance') {
            next = this.core.appendLog(next, 'Chance : pioche.');
            return this.drawAndApply(next, playerId, 'chance');
        }
        if (tile.type === 'community') {
            next = this.core.appendLog(next, 'Caisse de Communauté : pioche.');
            return this.drawAndApply(next, playerId, 'community');
        }
        if (tile.type === 'property' || tile.type === 'station' || tile.type === 'utility') {
            const owner = meta.ownership?.[pos];
            if (owner == null) {
                const price = this.getPurchasePrice(meta, tile);
                const pending = {
                    type: 'buy',
                    playerId,
                    blocking: true,
                    label: `Acheter "${tile.title}" (${price > 0 ? price + ' €' : 'prix inconnu'}) ?`,
                    choices: [
                        'Acheter',
                        'Passer'
                    ],
                    data: {
                        tileIndex: pos
                    }
                };
                return {
                    ...next,
                    pending
                };
            }
            if (owner === playerId) return next;
            const rules = this.getRules(meta);
            if (rules.rentBlockedInJail && (meta.statuses?.inJail?.[owner] ?? 0) > 0) {
                return this.core.appendLog(next, 'Le propriétaire est en prison : pas de loyer.');
            }
            const b = this.getBuilding(meta, pos);
            if (b.mortgaged) {
                return this.core.appendLog(next, 'Propriété hypothéquée : pas de loyer.');
            }
            const rent = this.getRent(meta, tile, pos, owner, state.lastRoll ?? 0);
            if (rent > 0) {
                next = this.core.appendLog(next, `Loyer : ${rent} € à ${(0, _playernamehelper.resolvePlayerNameFromState)(next, owner)}.`);
                next = this.addMoney(next, playerId, -rent, {
                    toPot: false
                });
                next = this.addMoney(next, owner, rent, {
                    toPot: false
                });
            }
            return next;
        }
        return next;
    }
    drawAndApply(state, playerId, deckId) {
        let next = state;
        const meta0 = this.getMeta(next);
        const drawn = this.drawCard(meta0, deckId);
        next = {
            ...next,
            metadata: {
                ...next.metadata ?? {},
                ...drawn.meta
            }
        };
        if (!drawn.card) return next;
        next = this.core.appendLog(next, `Carte : ${drawn.card.text}`);
        return this.applyCard(next, playerId, deckId, drawn.card);
    }
    applyCard(state, playerId, _deckId, card) {
        let next = state;
        const text = String(card.text ?? '');
        if (isGetOutOfJailCard(text)) {
            const meta = this.getMeta(next);
            const current = meta.statuses?.getOutOfJail?.[playerId] ?? 0;
            next = this.core.appendLog(next, 'Vous gardez cette carte.');
            return this.setGetOutOfJail(next, playerId, current + 1);
        }
        const everyone = extractAllPlayersMoney(text);
        if (everyone) {
            const meta0 = this.getMeta(next);
            const rules = this.getRules(meta0);
            const players = Array.isArray(next.players) ? next.players : [];
            const alive = players.map((p)=>p?.id).filter((id)=>typeof id === 'number' && Number.isFinite(id)).filter((id)=>!meta0.statuses?.eliminated?.[id]);
            if (everyone.kind === 'pay') {
                next = this.core.appendLog(next, `Tous les joueurs paient ${everyone.amount} €.`);
                for (const id of alive){
                    next = this.addMoney(next, id, -everyone.amount, {
                        toPot: rules.potEnabled && !everyone.toBank
                    });
                }
                return next;
            }
            next = this.core.appendLog(next, `Tous les joueurs reçoivent ${everyone.amount} €.`);
            for (const id of alive){
                next = this.addMoney(next, id, everyone.amount, {
                    toPot: false
                });
            }
            return next;
        }
        if (mentionsInfrastructureLoss(text)) {
            next = this.core.appendLog(next, 'Vous perdez une infrastructure.');
            return this.loseOneInfrastructure(next, playerId);
        }
        const delta = extractMoveDelta(text);
        if (delta !== 0) {
            next = this.core.appendLog(next, `Déplacement : ${delta > 0 ? '+' : ''}${delta}.`);
            next = this.moveForward(next, playerId, delta);
            return this.applyLanding(next, playerId);
        }
        if (/retournez\s+à\s+la\s+case\s+départ/i.test(text)) {
            next = this.core.appendLog(next, 'Retour à Départ.');
            return this.moveTo(next, playerId, 0, {
                collectStart: false
            });
        }
        const targetName = extractTargetPlace(text);
        if (targetName) {
            const target = this.findTileByName(this.getMeta(next).tiles, targetName);
            if (target != null) {
                next = this.core.appendLog(next, `Déplacement : vers "${targetName}".`);
                next = this.moveTo(next, playerId, target, {
                    collectStart: true
                });
                return this.applyLanding(next, playerId);
            }
        }
        const skip = extractSkipTurns(text);
        if (skip > 0) {
            next = this.core.appendLog(next, `Vous perdez ${skip} tour(s).`);
            next = this.addSkip(next, playerId, skip);
            return next;
        }
        const money = extractMoneyDelta(text);
        if (money !== 0) {
            next = this.core.appendLog(next, `Caisse : ${money > 0 ? '+' : ''}${money} €.`);
            next = this.addMoney(next, playerId, money, {
                toPot: money < 0
            });
            return next;
        }
        // Autres effets non implémentés : on log seulement.
        return next;
    }
    drawCard(meta, deckId) {
        const deck = meta.decks?.[deckId] ?? {
            cards: [],
            discard: []
        };
        const cards = Array.isArray(deck.cards) ? [
            ...deck.cards
        ] : [];
        const discard = Array.isArray(deck.discard) ? [
            ...deck.discard
        ] : [];
        const draw = this.deckPolicies.drawFromPile({
            meta,
            pile: cards,
            discard,
            useWholeMetaRng: true,
            discardDrawnCard: false
        });
        if (!draw.card) {
            const nextMeta = {
                ...draw.meta,
                decks: {
                    ...meta.decks,
                    [deckId]: {
                        cards: draw.pile,
                        discard: draw.discard
                    }
                }
            };
            return {
                card: null,
                meta: nextMeta
            };
        }
        const card = draw.card;
        const keep = isGetOutOfJailCard(String(card.text ?? ''));
        const nextDeck = keep ? {
            cards: draw.pile,
            discard: draw.discard
        } : {
            cards: draw.pile,
            discard: [
                ...draw.discard,
                card
            ]
        };
        const nextMeta = {
            ...draw.meta,
            decks: {
                ...meta.decks,
                [deckId]: nextDeck
            }
        };
        return {
            card,
            meta: nextMeta
        };
    }
    moveForward(state, playerId, delta) {
        const meta = this.getMeta(state);
        const rules = this.getRules(meta);
        const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
        const len = tiles.length || 40;
        const pos = meta.positions?.[playerId] ?? 0;
        const nextPos = ((pos + delta) % len + len) % len;
        let next = this.setPos(state, playerId, nextPos);
        if (delta > 0 && nextPos < pos) {
            next = this.core.appendLog(next, `Passage sur Départ : +${rules.passStartBonus} €.`);
            next = this.addMoney(next, playerId, rules.passStartBonus, {
                toPot: false
            });
        }
        return next;
    }
    moveTo(state, playerId, pos, options) {
        const meta = this.getMeta(state);
        const rules = this.getRules(meta);
        const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
        const len = tiles.length || 40;
        const current = meta.positions?.[playerId] ?? 0;
        const target = clamp(pos, 0, len - 1);
        let next = this.setPos(state, playerId, target);
        if (options.collectStart && target < current) {
            next = this.core.appendLog(next, `Passage sur Départ : +${rules.passStartBonus} €.`);
            next = this.addMoney(next, playerId, rules.passStartBonus, {
                toPot: false
            });
        }
        return next;
    }
    sendToJail(state, playerId) {
        const meta = this.getMeta(state);
        const rules = this.getRules(meta);
        const jailPos = this.findJailTile(meta.tiles) ?? 30;
        let next = this.setPos(state, playerId, jailPos);
        next = this.setJailTurns(next, playerId, rules.jail.maxTurns);
        return next;
    }
    findJailTile(tiles) {
        const list = Array.isArray(tiles) ? tiles : [];
        const idx = list.findIndex((t)=>t?.type === 'jail');
        return idx >= 0 ? idx : null;
    }
    findTileByName(tiles, rawName) {
        const name = normalize(rawName);
        if (!name) return null;
        const list = Array.isArray(tiles) ? tiles : [];
        const idx = list.findIndex((t)=>normalize(stripParens(t?.title ?? '')).includes(name));
        return idx >= 0 ? idx : null;
    }
    setPos(state, playerId, pos) {
        const meta = this.getMeta(state);
        const tiles = Array.isArray(meta.tiles) ? meta.tiles : [];
        const len = tiles.length || 40;
        const nextPos = clamp(pos, 0, len - 1);
        const nextMeta = {
            ...meta,
            positions: {
                ...meta.positions ?? {},
                [playerId]: nextPos
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    setOwner(state, tileIndex, ownerId) {
        const meta = this.getMeta(state);
        const nextMeta = {
            ...meta,
            ownership: {
                ...meta.ownership ?? {},
                [tileIndex]: ownerId
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    setPot(state, value) {
        const meta = this.getMeta(state);
        const nextMeta = {
            ...meta,
            pot: Math.max(0, Math.trunc(value))
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    addSkip(state, playerId, turns) {
        const meta = this.getMeta(state);
        const current = meta.statuses?.skipTurn?.[playerId] ?? 0;
        const nextMeta = {
            ...meta,
            statuses: {
                ...meta.statuses,
                skipTurn: {
                    ...meta.statuses.skipTurn ?? {},
                    [playerId]: current + turns
                }
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    setJailTurns(state, playerId, turns) {
        const meta = this.getMeta(state);
        const nextMeta = {
            ...meta,
            statuses: {
                ...meta.statuses,
                inJail: {
                    ...meta.statuses.inJail ?? {},
                    [playerId]: Math.max(0, Math.trunc(turns))
                }
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    setGetOutOfJail(state, playerId, count) {
        const meta = this.getMeta(state);
        const nextMeta = {
            ...meta,
            statuses: {
                ...meta.statuses,
                getOutOfJail: {
                    ...meta.statuses.getOutOfJail ?? {},
                    [playerId]: Math.max(0, Math.trunc(count))
                }
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    setExtraRoll(state, playerId, value) {
        const meta = this.getMeta(state);
        const nextMeta = {
            ...meta,
            statuses: {
                ...meta.statuses,
                extraRoll: {
                    ...meta.statuses.extraRoll ?? {},
                    [playerId]: Boolean(value)
                }
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    setConsecutiveDoubles(state, playerId, value) {
        const meta = this.getMeta(state);
        const nextMeta = {
            ...meta,
            statuses: {
                ...meta.statuses,
                consecutiveDoubles: {
                    ...meta.statuses.consecutiveDoubles ?? {},
                    [playerId]: Math.max(0, Math.trunc(value))
                }
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    advanceTurnOrExtraRoll(state, playerId) {
        const meta = this.getMeta(state);
        if (meta.statuses?.eliminated?.[playerId]) return this.advanceTurn(state);
        if (meta.statuses?.extraRoll?.[playerId]) {
            let next = this.setExtraRoll(state, playerId, false);
            next = this.core.appendLog(next, 'Double : vous rejouez.');
            return next;
        }
        return this.advanceTurn(state);
    }
    getBuilding(meta, tileIndex) {
        const current = meta.buildings?.[tileIndex];
        return {
            houses: clamp(Number(current?.houses ?? 0) || 0, 0, 4),
            hotel: Boolean(current?.hotel),
            mortgaged: Boolean(current?.mortgaged)
        };
    }
    setBuilding(state, tileIndex, patch) {
        const meta = this.getMeta(state);
        const current = this.getBuilding(meta, tileIndex);
        const nextBuilding = {
            houses: clamp(Number(patch.houses ?? current.houses) || 0, 0, 4),
            hotel: patch.hotel != null ? Boolean(patch.hotel) : current.hotel,
            mortgaged: patch.mortgaged != null ? Boolean(patch.mortgaged) : current.mortgaged
        };
        const nextMeta = {
            ...meta,
            buildings: {
                ...meta.buildings ?? {},
                [tileIndex]: nextBuilding
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    getGroup(meta, rawGroup) {
        const key = normalize(rawGroup);
        if (!key) return null;
        return meta.data?.groups?.find((g)=>normalize(g.color) === key) ?? null;
    }
    isGroupComplete(meta, ownerId, group) {
        const props = Array.isArray(group?.properties) ? group.properties : [];
        if (!props.length) return false;
        const idxs = props.map((name)=>this.findTileByName(meta.tiles, name)).filter((idx)=>idx != null);
        if (!idxs.length) return false;
        return idxs.every((idx)=>meta.ownership?.[idx] === ownerId && !this.getBuilding(meta, idx).mortgaged);
    }
    getMortgageValue(meta, tile) {
        if (tile.type === 'station') return meta.data?.stations?.mortgage ?? 0;
        if (tile.type === 'utility') {
            const u = meta.data?.utilities?.find((x)=>normalize(x.name) === normalize(tile.title));
            return u?.mortgage ?? 0;
        }
        if (tile.type === 'property') {
            const group = this.getGroup(meta, tile.group ?? '');
            return group?.mortgage ?? 0;
        }
        return 0;
    }
    getUnmortgageCost(meta, tile) {
        if (tile.type === 'station') return meta.data?.stations?.unmortgageCost ?? 0;
        if (tile.type === 'utility') {
            const u = meta.data?.utilities?.find((x)=>normalize(x.name) === normalize(tile.title));
            return u?.unmortgageCost ?? 0;
        }
        if (tile.type === 'property') {
            const group = this.getGroup(meta, tile.group ?? '');
            return group?.unmortgageCost ?? 0;
        }
        return 0;
    }
    buildOne(state, playerId, tileIndex) {
        const meta = this.getMeta(state);
        const tile = meta.tiles?.[tileIndex];
        if (!tile || tile.type !== 'property') return state;
        const group = this.getGroup(meta, tile.group ?? '');
        if (!group) return state;
        if (!this.isGroupComplete(meta, playerId, group)) return state;
        const b = this.getBuilding(meta, tileIndex);
        if (b.mortgaged || b.hotel) return state;
        const supportsHotel = Number(group?.hotelPrice ?? 0) > 0 && Number(group?.rents?.hotel ?? 0) > 0;
        if (!supportsHotel && b.houses >= 4) return state;
        const nextLevel = clamp(b.houses + 1, 1, 4);
        const houseCost = Number(group?.housePrices?.[String(nextLevel)] ?? group?.housePrice ?? 0) || 0;
        const cost = supportsHotel && b.houses >= 4 ? Number(group.hotelPrice ?? 0) || 0 : houseCost;
        const cash = meta.money?.[playerId] ?? 0;
        if (!Number.isFinite(cost) || cost <= 0 || cash < cost) return state;
        let next = state;
        next = this.addMoney(next, playerId, -cost, {
            toPot: false
        });
        if (this.getMeta(next).statuses?.eliminated?.[playerId]) return next;
        if (supportsHotel && b.houses >= 4) {
            next = this.core.appendLog(next, `Hôtel construit sur "${tile.title}".`);
            return this.setBuilding(next, tileIndex, {
                hotel: true,
                houses: 0
            });
        }
        next = this.core.appendLog(next, `Maison construite sur "${tile.title}".`);
        return this.setBuilding(next, tileIndex, {
            houses: b.houses + 1,
            hotel: false
        });
    }
    sellOne(state, playerId, tileIndex) {
        const meta = this.getMeta(state);
        const tile = meta.tiles?.[tileIndex];
        if (!tile || tile.type !== 'property') return state;
        const group = this.getGroup(meta, tile.group ?? '');
        if (!group) return state;
        const supportsHotel = Number(group?.hotelPrice ?? 0) > 0 && Number(group?.rents?.hotel ?? 0) > 0;
        const b = this.getBuilding(meta, tileIndex);
        if (!b.hotel && b.houses <= 0) return state;
        if (supportsHotel && b.hotel) {
            const refund = Math.floor((group.hotelPrice ?? 0) / 2);
            let next = this.core.appendLog(state, `Hôtel vendu sur "${tile.title}" (+${refund} €).`);
            next = this.setBuilding(next, tileIndex, {
                hotel: false,
                houses: 4
            });
            return this.addMoney(next, playerId, refund, {
                toPot: false
            });
        }
        const level = clamp(b.houses, 1, 4);
        const cost = Number(group?.housePrices?.[String(level)] ?? group?.housePrice ?? 0) || 0;
        const refund = Math.floor(cost / 2);
        let next = this.core.appendLog(state, `Maison vendue sur "${tile.title}" (+${refund} €).`);
        next = this.setBuilding(next, tileIndex, {
            houses: Math.max(0, b.houses - 1)
        });
        return this.addMoney(next, playerId, refund, {
            toPot: false
        });
    }
    mortgageTile(state, playerId, tileIndex) {
        const meta = this.getMeta(state);
        const tile = meta.tiles?.[tileIndex];
        if (!tile) return state;
        if (meta.ownership?.[tileIndex] !== playerId) return state;
        const b = this.getBuilding(meta, tileIndex);
        if (b.mortgaged) return state;
        if (tile.type === 'property' && (b.hotel || b.houses > 0)) return state;
        const amount = this.getMortgageValue(meta, tile);
        if (!Number.isFinite(amount) || amount <= 0) return state;
        let next = this.core.appendLog(state, `Hypothèque : "${tile.title}" (+${amount} €).`);
        next = this.setBuilding(next, tileIndex, {
            mortgaged: true
        });
        return this.addMoney(next, playerId, amount, {
            toPot: false
        });
    }
    unmortgageTile(state, playerId, tileIndex) {
        const meta = this.getMeta(state);
        const tile = meta.tiles?.[tileIndex];
        if (!tile) return state;
        if (meta.ownership?.[tileIndex] !== playerId) return state;
        const b = this.getBuilding(meta, tileIndex);
        if (!b.mortgaged) return state;
        const cost = this.getUnmortgageCost(meta, tile);
        const cash = meta.money?.[playerId] ?? 0;
        if (!Number.isFinite(cost) || cost <= 0 || cash < cost) return state;
        let next = this.core.appendLog(state, `Levée d’hypothèque : "${tile.title}" (-${cost} €).`);
        next = this.addMoney(next, playerId, -cost, {
            toPot: false
        });
        if (this.getMeta(next).statuses?.eliminated?.[playerId]) return next;
        return this.setBuilding(next, tileIndex, {
            mortgaged: false
        });
    }
    loseOneInfrastructure(state, playerId) {
        const meta0 = this.getMeta(state);
        const tiles = Array.isArray(meta0.tiles) ? meta0.tiles : [];
        const ownedWithInfra = [];
        for(let i = 0; i < tiles.length; i += 1){
            const owner = meta0.ownership?.[i];
            if (owner !== playerId) continue;
            const tile = tiles[i];
            if (!tile || tile.type !== 'property') continue;
            const b = this.getBuilding(meta0, i);
            if (b.hotel || b.houses > 0) ownedWithInfra.push(i);
        }
        if (!ownedWithInfra.length) {
            return this.core.appendLog(state, 'Aucune infrastructure à perdre.');
        }
        const picked = this.random.pickOne(meta0, ownedWithInfra);
        let next = {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...meta0,
                ...picked.meta
            }
        };
        const tileIndex = picked.value;
        if (tileIndex == null) return next;
        const tile = tiles[tileIndex];
        const group = tile ? this.getGroup(this.getMeta(next), tile.group ?? '') : null;
        const supportsHotel = Number(group?.hotelPrice ?? 0) > 0 && Number(group?.rents?.hotel ?? 0) > 0;
        const b = this.getBuilding(this.getMeta(next), tileIndex);
        if (supportsHotel && b.hotel) {
            next = this.core.appendLog(next, `Infrastructure perdue : hôtel sur "${tile?.title ?? 'propriété'}".`);
            return this.setBuilding(next, tileIndex, {
                hotel: false,
                houses: 4
            });
        }
        if (b.houses > 0) {
            next = this.core.appendLog(next, `Infrastructure perdue : -1 sur "${tile?.title ?? 'propriété'}".`);
            return this.setBuilding(next, tileIndex, {
                houses: Math.max(0, b.houses - 1)
            });
        }
        return next;
    }
    addMoney(state, playerId, delta, options) {
        const meta = this.getMeta(state);
        const current = meta.money?.[playerId] ?? 0;
        const nextMoney = current + delta;
        const rules = this.getRules(meta);
        const nextMeta = {
            ...meta,
            money: {
                ...meta.money ?? {},
                [playerId]: nextMoney
            },
            pot: rules.potEnabled && options.toPot ? (meta.pot ?? 0) + Math.max(0, -delta) : meta.pot ?? 0
        };
        let next = {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
        if (nextMoney < 0) {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, playerId)} est en faillite !`);
            next = this.setEliminated(next, playerId, true);
            next = this.releaseAssets(next, playerId);
        }
        return next;
    }
    releaseAssets(state, playerId) {
        const meta = this.getMeta(state);
        const ownership = {
            ...meta.ownership ?? {}
        };
        const buildings = {
            ...meta.buildings ?? {}
        };
        for (const [k, v] of Object.entries(ownership)){
            if (Number(v) === playerId) {
                delete ownership[k];
                delete buildings[k];
            }
        }
        const money = {
            ...meta.money ?? {},
            [playerId]: 0
        };
        const statuses = meta.statuses ?? {};
        const nextMeta = {
            ...meta,
            ownership,
            buildings,
            money,
            statuses: {
                ...statuses,
                inJail: {
                    ...statuses.inJail ?? {},
                    [playerId]: 0
                },
                skipTurn: {
                    ...statuses.skipTurn ?? {},
                    [playerId]: 0
                },
                extraRoll: {
                    ...statuses.extraRoll ?? {},
                    [playerId]: false
                },
                consecutiveDoubles: {
                    ...statuses.consecutiveDoubles ?? {},
                    [playerId]: 0
                }
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    setEliminated(state, playerId, value) {
        const meta = this.getMeta(state);
        const nextMeta = {
            ...meta,
            statuses: {
                ...meta.statuses,
                eliminated: {
                    ...meta.statuses.eliminated ?? {},
                    [playerId]: Boolean(value)
                }
            }
        };
        return {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...nextMeta
            }
        };
    }
    getPurchasePrice(meta, tile) {
        if (tile.type === 'station') return meta.data?.stations?.purchasePrice ?? 0;
        if (tile.type === 'utility') {
            const u = meta.data?.utilities?.find((x)=>normalize(x.name) === normalize(tile.title));
            return u?.purchasePrice ?? 0;
        }
        if (tile.type === 'property') {
            const group = meta.data?.groups?.find((g)=>normalize(g.color) === normalize(tile.group ?? ''));
            return group?.purchasePrice ?? 0;
        }
        return 0;
    }
    getRent(meta, tile, tileIndex, ownerId, lastRoll) {
        if (tile.type === 'station') {
            const stations = meta.data?.stations?.properties ?? [];
            const count = stations.map((name)=>this.findTileByName(meta.tiles, name)).filter((idx)=>idx != null).filter((idx)=>meta.ownership?.[idx] === ownerId).length;
            const rents = meta.data?.stations?.rents ?? {};
            const key = String(clamp(count, 1, 4));
            return Number(rents[key] ?? 0) || 0;
        }
        if (tile.type === 'utility') {
            const utils = meta.data?.utilities ?? [];
            const idxs = utils.map((u)=>this.findTileByName(meta.tiles, u.name)).filter((idx)=>idx != null);
            const owned = idxs.filter((idx)=>meta.ownership?.[idx] === ownerId).length;
            const multiplier = owned >= 2 ? utils[0]?.multiplier2 ?? 10 : utils[0]?.multiplier1 ?? 4;
            return Math.max(0, Math.trunc(multiplier * Math.max(0, lastRoll)));
        }
        if (tile.type === 'property') {
            const group = meta.data?.groups?.find((g)=>normalize(g.color) === normalize(tile.group ?? ''));
            if (!group) return 0;
            const b = this.getBuilding(meta, tileIndex);
            if (b.hotel) return Number(group.rents?.hotel ?? 0) || 0;
            const houses = clamp(Number(b.houses ?? 0) || 0, 0, 4);
            if (houses <= 0) return Number(group.rents?.base ?? 0) || 0;
            if (houses === 1) return Number(group.rents?.house1 ?? 0) || 0;
            if (houses === 2) return Number(group.rents?.house2 ?? 0) || 0;
            if (houses === 3) return Number(group.rents?.house3 ?? 0) || 0;
            return Number(group.rents?.house4 ?? 0) || 0;
        }
        return 0;
    }
    advanceTurn(state) {
        const players = Array.isArray(state.players) ? state.players : [];
        if (!players.length) return state;
        const meta = this.getMeta(state);
        const statuses = meta.statuses ?? {};
        const skipTurn = {
            ...statuses.skipTurn ?? {}
        };
        const eliminated = statuses.eliminated ?? {};
        const currentId = state.turn?.currentPlayerId ?? null;
        const currentIndex = currentId != null ? players.findIndex((p)=>p?.id === currentId) : state.turnIndex;
        let nextIndex = currentIndex >= 0 ? currentIndex : state.turnIndex;
        let attempts = 0;
        let nextPlayerId = players[nextIndex]?.id ?? players[0].id;
        do {
            nextIndex = (nextIndex + 1) % players.length;
            const pid = players[nextIndex].id;
            if (eliminated?.[pid]) {
                attempts += 1;
                continue;
            }
            const remaining = skipTurn[pid] ?? 0;
            if (remaining > 0) {
                skipTurn[pid] = remaining - 1;
                attempts += 1;
                continue;
            }
            nextPlayerId = pid;
            break;
        }while (attempts < players.length)
        return {
            ...state,
            turnIndex: nextIndex,
            turn: {
                currentPlayerId: nextPlayerId,
                direction: 1
            },
            metadata: {
                ...state.metadata ?? {},
                ...meta,
                statuses: {
                    ...statuses,
                    skipTurn
                }
            }
        };
    }
    checkWinner(state) {
        const meta = this.getMeta(state);
        if (meta.winnerId != null) return state;
        const players = Array.isArray(state.players) ? state.players : [];
        const alive = players.map((p)=>p?.id).filter((id)=>typeof id === 'number' && Number.isFinite(id)).filter((id)=>!meta.statuses?.eliminated?.[id]);
        if (alive.length === 1) {
            const winnerId = alive[0];
            const nextMeta = {
                ...meta,
                winnerId
            };
            const next = {
                ...state,
                metadata: {
                    ...state.metadata ?? {},
                    ...nextMeta
                }
            };
            return this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, winnerId)} remporte la partie !`);
        }
        return state;
    }
    getMeta(state) {
        return state.metadata ?? {};
    }
    getRules(meta) {
        const defaults = {
            startMoney: 2000,
            passStartBonus: 200,
            potEnabled: true,
            rentBlockedInJail: true,
            jail: {
                maxTurns: 3,
                autoFine: 100,
                allowPayFine: true,
                allowDoubleEscape: false
            }
        };
        const r = meta.rules ?? {};
        return {
            ...defaults,
            ...r,
            jail: {
                ...defaults.jail,
                ...r.jail ?? {}
            }
        };
    }
    pawnLabel(state, id) {
        const players = Array.isArray(state.players) ? state.players : [];
        const player = players.find((p)=>p?.id === id);
        const explicitLabel = String(player?.pawnLabel ?? '').trim();
        if (explicitLabel) return `"${explicitLabel}"`;
        const pawnId = String(player?.pawn ?? '').trim();
        if (pawnId) return `"${pawnId}"`;
        const fallback = (0, _playernamehelper.resolvePlayerNameFromState)(state, id);
        return `"${fallback}"`;
    }
    constructor(random, core, setup, deckPolicies){
        this.random = random;
        this.core = core;
        this.setup = setup;
        this.deckPolicies = deckPolicies;
    }
};
SacAMalicesActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService,
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _sacamalicessetupservice.SacAMalicesSetupService === "undefined" ? Object : _sacamalicessetupservice.SacAMalicesSetupService,
        typeof _deckpoliciesservice.DeckPoliciesService === "undefined" ? Object : _deckpoliciesservice.DeckPoliciesService
    ])
], SacAMalicesActionService);
function clamp(value, min, max) {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}
function stripParens(text) {
    return String(text ?? '').replace(/\([^)]*\)/g, '').trim();
}
function normalize(value) {
    return String(value ?? '').trim().toLowerCase().replace(/[’'`]/g, "'").replace(/\s+/g, ' ');
}
function extractEuroAmount(text) {
    const m = text.match(/(\d+)\s*(€|eur)/i);
    const n = m ? Number(m[1]) : 0;
    return Number.isFinite(n) ? Math.trunc(n) : 0;
}
function extractMoneyDelta(text) {
    const gain = text.match(/(?:recevez|reçois|recois|gagnez|gagne)\s+(\d+)/i);
    if (gain) {
        const n = Number(gain[1]);
        if (Number.isFinite(n)) return Math.trunc(n);
    }
    const pay = text.match(/(?:payez|paie|paye)\s+(\d+)/i);
    if (pay) {
        const n = Number(pay[1]);
        if (Number.isFinite(n)) return -Math.trunc(n);
    }
    return 0;
}
function extractMoveDelta(text) {
    const parse = (raw)=>{
        const v = raw.trim().toLowerCase();
        const n = Number(v);
        if (Number.isFinite(n)) return n;
        const map = {
            un: 1,
            une: 1,
            deux: 2,
            trois: 3,
            quatre: 4,
            cinq: 5,
            six: 6
        };
        return map[v] ?? 0;
    };
    const forward = text.match(/avance(?:z)?\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i);
    if (forward) return parse(forward[1]);
    const backward = text.match(/recule(?:z)?\s+de\s+([0-9]+|un|une|deux|trois|quatre|cinq|six)\s+case/i);
    if (backward) return -parse(backward[1]);
    return 0;
}
function extractSkipTurns(text) {
    if (/Passez trois tours/i.test(text)) return 3;
    if (/Passez deux tours/i.test(text)) return 2;
    if (/Passez votre prochain tour/i.test(text) || /Passez votre tour/i.test(text)) return 1;
    return 0;
}
function extractTargetPlace(text) {
    const m1 = text.match(/avancez\s+jusqu[’']?à\s+la\s+gare\s+de\s+([^.,]+)/i);
    if (m1?.[1]) return `Gare de ${m1[1].trim()}`;
    const m2 = text.match(/avancez\s+(?:directement\s+)?à\s+([^.,]+)/i);
    if (m2?.[1]) return m2[1].trim();
    return null;
}
function isGetOutOfJailCard(text) {
    return /Sortie de prison/i.test(text) || /Lib[ée]ration/i.test(text);
}
function extractAllPlayersMoney(textRaw) {
    const text = String(textRaw ?? '');
    const toBank = /banque/i.test(text);
    const pay = text.match(/Tous\s+les\s+joueurs\s+(?:paient|payent)\s+(\d+)/i);
    if (pay?.[1]) {
        const n = Number(pay[1]);
        if (Number.isFinite(n) && n > 0) return {
            kind: 'pay',
            amount: Math.trunc(n),
            toBank
        };
    }
    const receive = text.match(/Tous\s+les\s+joueurs\s+re[çc]oivent\s+(\d+)/i);
    if (receive?.[1]) {
        const n = Number(receive[1]);
        if (Number.isFinite(n) && n > 0) return {
            kind: 'receive',
            amount: Math.trunc(n),
            toBank
        };
    }
    return null;
}
function mentionsInfrastructureLoss(text) {
    return /perd(?:ez|s)?\s+une\s+infrastructure/i.test(text) || /perds\s+une\s+infrastructure/i.test(text);
}
