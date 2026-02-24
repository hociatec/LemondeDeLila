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
exports.PanierExpressExchangeService = void 0;
const common_1 = require("@nestjs/common");
const game_core_service_1 = require("../../../../core/services/game-core.service");
const playing_logger_1 = require("../../../../../common/utils/playing-logger");
const panier_express_utils_service_1 = require("../model/panier-express-utils.service");
const panier_express_deck_service_1 = require("./panier-express-deck.service");
const interactive_exchange_model_1 = require("../../../../modules/exchange/model/interactive-exchange.model");
const interactive_exchange_service_1 = require("../../../../modules/exchange/services/interactive-exchange.service");
const panier_express_setup_service_1 = require("../setup/panier-express-setup.service");
const random_service_1 = require("../../../../modules/random/services/random.service");
let PanierExpressExchangeService = class PanierExpressExchangeService {
    core;
    utils;
    deckHelper;
    exchangeFlow;
    setup;
    random;
    constructor(core, utils, deckHelper, exchangeFlow, setup, random) {
        this.core = core;
        this.utils = utils;
        this.deckHelper = deckHelper;
        this.exchangeFlow = exchangeFlow;
        this.setup = setup;
        this.random = random;
    }
    applyExchange(state, playerId) {
        if (state.pending) {
            return this.core.appendLog(state, `[Panier Express] Un autre événement est déjà en attente.`);
        }
        return this.requestExchange(state, playerId);
    }
    chooseTarget(state, playerId, targetPlayerId) {
        const result = this.exchangeFlow.chooseTarget(state, playerId, targetPlayerId, this.adapter());
        if (result.kind === 'updated')
            return result.state;
        return this.core.appendLog(state, "[Panier Express] Cible d'échange invalide.");
    }
    chooseGive(state, playerId, give) {
        const result = this.exchangeFlow.chooseGive(state, playerId, give, this.adapter());
        if (result.kind !== 'offered') {
            return this.core.appendLog(state, '[Panier Express] Échange invalide.');
        }
        const offer = result.offer;
        const giveLabel = this.utils.formatCourseLabel(offer.give);
        const takeLabel = offer.take != null ? this.utils.formatCourseLabel(offer.take) : null;
        const takeText = takeLabel != null ? `"${takeLabel}"` : 'aucune carte';
        return this.core.appendLog(result.state, `[Panier Express] ${offer.initiatorUsername} propose un échange à ${offer.targetUsername} : il donne "${giveLabel}" et recevra ${takeText}.`);
    }
    acceptOffer(state, targetPlayerId) {
        const result = this.exchangeFlow.acceptOffer(state, targetPlayerId, this.adapter());
        if (result.kind !== 'resolved') {
            return this.core.appendLog(state, "[Panier Express] Acceptation d'échange invalide.");
        }
        const offer = result.offer;
        const giveLabel = this.utils.formatCourseLabel(offer.give);
        const takeLabel = offer.take != null ? this.utils.formatCourseLabel(offer.take) : null;
        if (offer.bonusRequested) {
            const after = this.core.appendLog(result.state, `[Panier Express] Échange accepté : ${offer.initiatorUsername} donne "${giveLabel}" à ${offer.targetUsername}. ${offer.targetUsername} n'a aucune carte et perd 2 tours.`);
            return {
                ...after,
                pending: {
                    type: 'draw',
                    playerId: offer.initiatorPlayerId,
                    blocking: true,
                    label: 'Piocher une course bonus (Espace).',
                    data: {
                        kind: 'queue',
                        queue: [{ playerId: offer.initiatorPlayerId, standId: 'bonus' }],
                        cursor: 0,
                    },
                },
            };
        }
        (0, playing_logger_1.playingLog)('panier.exchange.resolve', {
            roomId: state.metadata?.roomId ?? null,
            gameType: state.metadata?.gameType ?? null,
            userId: offer.initiatorPlayerId,
            type: 'exchange_resolve',
            playerId: offer.initiatorPlayerId,
            targetPlayerId: offer.targetPlayerId,
        });
        return this.core.appendLog(result.state, `[Panier Express] Échange accepté : ${offer.initiatorUsername} donne "${giveLabel}" et reçoit "${takeLabel ?? ''}" de ${offer.targetUsername}.`);
    }
    refuseOffer(state, targetPlayerId) {
        const pending = state.pending;
        const offer = pending && pending.type === 'exchange' && pending.step === 'confirm'
            ? pending
            : null;
        const cleared = this.exchangeFlow.refuseOffer(state, targetPlayerId);
        if (!offer) {
            return this.core.appendLog(state, "[Panier Express] Refus d'échange invalide.");
        }
        return this.core.appendLog(cleared, `[Panier Express] ${offer.targetUsername} refuse l'échange proposé par ${offer.initiatorUsername}.`);
    }
    applyExchangeCard(state, initiatorPlayerId, targetPlayerId, card) {
        const kind = String(card ?? '').trim();
        if (!kind)
            return state;
        if (kind === 'vol-discret') {
            const meta = (state.metadata ?? {});
            const target = (state.players ?? []).find((p) => p.id === targetPlayerId);
            const inv = this.utils.toStringArray(target?.inventory);
            if (!inv.length) {
                return this.core.appendLog(state, `[Panier Express] Vol discret : ${this.utils.playerName(state, targetPlayerId)} n'a aucune carte.`);
            }
            const metaRng = this.random.createMetaRng(meta);
            const picked = this.random.pickOne(metaRng.getMeta(), inv);
            const stolen = String(picked.value ?? '').trim();
            if (!stolen)
                return state;
            let next = { ...state, metadata: picked.meta };
            next = removeFromInventoryState(this.utils, next, targetPlayerId, stolen);
            next = addCardToPlayerState(this.utils, next, initiatorPlayerId, stolen);
            return this.core.appendLog(next, `[Panier Express] Vol discret : ${this.utils.playerName(state, initiatorPlayerId)} vole "${stolen}" à ${this.utils.playerName(state, targetPlayerId)}.`);
        }
        if (kind === 'chariot-echange') {
            const initiator = (state.players ?? []).find((p) => p.id === initiatorPlayerId);
            const target = (state.players ?? []).find((p) => p.id === targetPlayerId);
            const initiatorInv = this.utils.toStringArray(initiator?.inventory);
            const targetInv = this.utils.toStringArray(target?.inventory);
            let next = state;
            next = setInventoryState(this.utils, next, initiatorPlayerId, []);
            next = setInventoryState(this.utils, next, targetPlayerId, []);
            targetInv.forEach((card) => {
                next = addCardToPlayerState(this.utils, next, initiatorPlayerId, card);
            });
            initiatorInv.forEach((card) => {
                next = addCardToPlayerState(this.utils, next, targetPlayerId, card);
            });
            return this.core.appendLog(next, `[Panier Express] Chariot échangé : ${this.utils.playerName(state, initiatorPlayerId)} échange son inventaire avec ${this.utils.playerName(state, targetPlayerId)}.`);
        }
        if (kind === 'echange-force') {
            const initiator = (state.players ?? []).find((p) => p.id === initiatorPlayerId);
            const target = (state.players ?? []).find((p) => p.id === targetPlayerId);
            const initiatorInv = this.utils.toStringArray(initiator?.inventory);
            const targetInv = this.utils.toStringArray(target?.inventory);
            if (!initiatorInv.length || !targetInv.length) {
                return this.core.appendLog(state, `[Panier Express] Échange forcé : inventaire vide.`);
            }
            let next = state;
            const metaRng = this.random.createMetaRng(next.metadata ?? {});
            const pickA = this.random.pickOne(metaRng.getMeta(), initiatorInv);
            next = { ...next, metadata: pickA.meta };
            const aCard = String(pickA.value ?? '').trim();
            const pickB = this.random.pickOne(next.metadata ?? {}, targetInv);
            next = { ...next, metadata: pickB.meta };
            const bCard = String(pickB.value ?? '').trim();
            if (aCard)
                next = removeFromInventoryState(this.utils, next, initiatorPlayerId, aCard);
            if (bCard)
                next = removeFromInventoryState(this.utils, next, targetPlayerId, bCard);
            if (aCard)
                next = addCardToPlayerState(this.utils, next, targetPlayerId, aCard);
            if (bCard)
                next = addCardToPlayerState(this.utils, next, initiatorPlayerId, bCard);
            return this.core.appendLog(next, `[Panier Express] Échange forcé : échange au hasard entre ${this.utils.playerName(state, initiatorPlayerId)} et ${this.utils.playerName(state, targetPlayerId)}.`);
        }
        if (kind === 'echange-impose') {
            const target = (state.players ?? []).find((p) => p.id === targetPlayerId);
            const inv = this.utils.toStringArray(target?.inventory);
            if (!inv.length) {
                return this.core.appendLog(state, `[Panier Express] Échange imposé : ${this.utils.playerName(state, targetPlayerId)} n'a aucune carte.`);
            }
            return {
                ...state,
                pending: {
                    type: 'pick',
                    playerId: targetPlayerId,
                    blocking: true,
                    label: `Choisissez une carte à donner à ${this.utils.playerName(state, initiatorPlayerId)}, puis Entrée.`,
                    choices: inv,
                    data: {
                        kind: 'exchange.impose.choose_card',
                        initiatorId: initiatorPlayerId,
                        cards: inv,
                    },
                },
            };
        }
        return this.core.appendLog(state, `[Panier Express] Carte d'échange non gérée : ${kind}.`);
    }
    requestExchange(state, playerId) {
        const meta = state.metadata;
        if (!meta.decks) {
            return this.core.appendLog(state, '[Panier Express] Decks indisponibles pour les échanges.');
        }
        const draw = this.deckHelper.drawWithReplenish(meta, 'exchanges', () => this.setup.exchangeCards());
        const metadata = draw.metadata;
        const resolvedCard = draw.card ?? 'exchange';
        if ([
            'vol-discret',
            'chariot-echange',
            'echange-impose',
            'echange-force',
        ].includes(resolvedCard)) {
            const targets = (state.players ?? [])
                .filter((p) => p.id !== playerId)
                .map((p) => ({ playerId: p.id, username: p.username }));
            const choices = targets
                .map((t) => String(t.username ?? ''))
                .filter((v) => v.length > 0);
            if (!choices.length) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] Aucun joueur disponible pour ${resolvedCard}.`);
            }
            const exchangeLabel = this.utils.formatEventLabel(resolvedCard) || resolvedCard;
            return {
                ...state,
                metadata,
                pending: {
                    type: 'pick',
                    playerId,
                    blocking: true,
                    label: `Choisissez un joueur pour ${exchangeLabel}, puis Entrée.`,
                    choices,
                    data: { kind: 'exchange.choose_target', card: resolvedCard, targets },
                },
            };
        }
        if (resolvedCard === 'troc-rapide') {
            const players = state.players ?? [];
            if (players.length < 2) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] Troc rapide : aucun joueur disponible.`);
            }
            const idx = players.findIndex((p) => p.id === playerId);
            const targetPlayerId = Number(players[(idx - 1 + players.length) % players.length]?.id);
            const me = (state.players ?? []).find((p) => p.id === playerId);
            const inv = this.utils.toStringArray(me?.inventory);
            if (!inv.length) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] Troc rapide : inventaire vide.`);
            }
            return {
                ...state,
                metadata,
                pending: {
                    type: 'pick',
                    playerId,
                    blocking: true,
                    label: `Choisissez une carte à échanger avec ${this.utils.playerName(state, targetPlayerId)}, puis Entrée.`,
                    choices: inv,
                    data: { kind: 'exchange.troc_rapide.choose_give', targetPlayerId },
                },
            };
        }
        if (resolvedCard === 'troc-fruit-legume') {
            const targets = (state.players ?? [])
                .filter((p) => p.id !== playerId)
                .map((p) => ({ playerId: p.id, username: p.username }));
            const choices = targets
                .map((t) => String(t.username ?? ''))
                .filter((v) => v.length > 0);
            if (!choices.length) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] Troc fruit/l?gume : aucun joueur disponible.`);
            }
            return {
                ...state,
                metadata,
                pending: {
                    type: 'pick',
                    playerId,
                    blocking: true,
                    label: 'Choisissez un joueur pour le troc, puis Entrée.',
                    choices,
                    data: { kind: 'exchange.troc_fruit_legume.choose_target', targets },
                },
            };
        }
        if (resolvedCard === 'echange-saison') {
            const targets = (state.players ?? [])
                .filter((p) => p.id !== playerId)
                .map((p) => ({ playerId: p.id, username: p.username }));
            const choices = targets
                .map((t) => String(t.username ?? ''))
                .filter((v) => v.length > 0);
            if (!choices.length) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] Échange de saison : aucun joueur disponible.`);
            }
            return {
                ...state,
                metadata,
                pending: {
                    type: 'pick',
                    playerId,
                    blocking: true,
                    label: 'Choisissez un joueur pour l’échange de saison, puis Entrée.',
                    choices,
                    data: { kind: 'exchange.echange_saison.choose_target', targets },
                },
            };
        }
        if (resolvedCard === 'echange-strategique') {
            const targets = (state.players ?? [])
                .filter((p) => p.id !== playerId)
                .map((p) => ({ playerId: p.id, username: p.username }));
            const choices = targets
                .map((t) => String(t.username ?? ''))
                .filter((v) => v.length > 0);
            if (!choices.length) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] Échange stratégique : aucun joueur disponible.`);
            }
            const exchangeIdOut = this.random.nextInt(metadata, 1_000_000_000);
            const nextMetadata = exchangeIdOut.meta;
            const exchangeId = exchangeIdOut.value;
            return {
                ...state,
                metadata: nextMetadata,
                pending: {
                    type: 'pick',
                    playerId,
                    blocking: true,
                    label: "Choisissez un joueur pour l'échange stratégique, puis Entrée.",
                    choices,
                    data: {
                        kind: 'exchange.strategique.choose_target',
                        exchangeId,
                        targets,
                    },
                },
            };
        }
        if (resolvedCard === 'marche-noir') {
            const me = (state.players ?? []).find((p) => p.id === playerId);
            const cards = this.utils.toStringArray(me?.inventory);
            if (!cards.length) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] Marché noir : aucune carte à défausser.`);
            }
            return {
                ...state,
                metadata,
                pending: {
                    type: 'pick',
                    playerId,
                    blocking: true,
                    label: 'Choisissez une carte à défausser, puis Entrée.',
                    choices: cards,
                    data: { kind: 'exchange.marche_noir.discard' },
                },
            };
        }
        if (resolvedCard === 'echange-devant' ||
            resolvedCard === 'echange-derriere') {
            const exchangeLabel = this.utils.formatEventLabel(resolvedCard);
            const players = state.players ?? [];
            if (players.length < 2) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] ${exchangeLabel} : aucun joueur disponible.`);
            }
            const idx = players.findIndex((p) => p.id === playerId);
            const targetPlayerId = Number(players[resolvedCard === 'echange-devant'
                ? (idx + 1) % players.length
                : (idx - 1 + players.length) % players.length]?.id);
            const me = (state.players ?? []).find((p) => p.id === playerId);
            const target = (state.players ?? []).find((p) => p.id === targetPlayerId);
            const myInv = this.utils.toStringArray(me?.inventory);
            const theirInv = this.utils.toStringArray(target?.inventory);
            if (!myInv.length || !theirInv.length) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] ${exchangeLabel} : inventaire vide.`);
            }
            let next = { ...state, metadata };
            const metaRng = this.random.createMetaRng(next.metadata ?? {});
            const pickA = this.random.pickOne(metaRng.getMeta(), myInv);
            next = { ...next, metadata: pickA.meta };
            const aCard = String(pickA.value ?? '').trim();
            const pickB = this.random.pickOne(next.metadata ?? {}, theirInv);
            next = { ...next, metadata: pickB.meta };
            const bCard = String(pickB.value ?? '').trim();
            if (aCard)
                next = removeFromInventoryState(this.utils, next, playerId, aCard);
            if (bCard)
                next = removeFromInventoryState(this.utils, next, targetPlayerId, bCard);
            if (aCard)
                next = addCardToPlayerState(this.utils, next, targetPlayerId, aCard);
            if (bCard)
                next = addCardToPlayerState(this.utils, next, playerId, bCard);
            const positionLabel = resolvedCard === 'echange-devant'
                ? 'juste devant vous'
                : 'juste derrière vous';
            return this.core.appendLog(next, `[Panier Express] ${exchangeLabel} : échange au hasard avec le joueur ${positionLabel} (${this.utils.playerName(state, targetPlayerId)}).`);
        }
        if (resolvedCard === 'panier-mixe') {
            const metaAny = metadata;
            const positions = (metaAny.positions ?? {});
            const tiles = Array.isArray(metaAny.tiles) ? metaAny.tiles : [];
            const total = tiles.length || 1;
            const others = (state.players ?? []).filter((p) => p.id !== playerId);
            if (!others.length) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] Panier mixé : aucun joueur disponible.`);
            }
            const mePos = positions[playerId] ?? 0;
            let targetPlayerId = others[0].id;
            let bestDist = Number.POSITIVE_INFINITY;
            others.forEach((p) => {
                const pos = positions[p.id] ?? 0;
                const forward = (pos - mePos + total) % total;
                const backward = (mePos - pos + total) % total;
                const dist = Math.min(forward, backward);
                if (dist < bestDist) {
                    bestDist = dist;
                    targetPlayerId = p.id;
                }
            });
            const me = (state.players ?? []).find((p) => p.id === playerId);
            const target = (state.players ?? []).find((p) => p.id === targetPlayerId);
            const aInv = this.utils.toStringArray(me?.inventory);
            const bInv = this.utils.toStringArray(target?.inventory);
            const combined = [...aInv, ...bInv];
            if (!combined.length) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] Panier mixé : aucun inventaire à mélanger.`);
            }
            const shuffled = this.random.shuffle(metadata ?? {}, combined);
            let next = { ...state, metadata: shuffled.meta };
            next = setInventoryState(this.utils, next, playerId, []);
            next = setInventoryState(this.utils, next, targetPlayerId, []);
            const half = Math.floor(shuffled.values.length / 2);
            const aCards = shuffled.values.slice(0, half);
            const bCards = shuffled.values.slice(half, half * 2);
            const leftover = shuffled.values.slice(half * 2);
            aCards.forEach((c) => {
                next = addCardToPlayerState(this.utils, next, playerId, c);
            });
            bCards.forEach((c) => {
                next = addCardToPlayerState(this.utils, next, targetPlayerId, c);
            });
            leftover.forEach((c) => {
                next = addToDiscardState(next, c);
            });
            return this.core.appendLog(next, `[Panier Express] Panier mixé : mélange avec ${this.utils.playerName(state, targetPlayerId)}.`);
        }
        if (resolvedCard === 'echange-masque') {
            const eligible = (state.players ?? []).filter((p) => this.utils.toStringArray(p.inventory).length > 0);
            if (eligible.length < 2) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] Échange masqué : pas assez de joueurs avec des cartes.`);
            }
            const shuffledPlayers = this.random.shuffle(metadata ?? {}, eligible.map((p) => p.id));
            let next = {
                ...state,
                metadata: shuffledPlayers.meta,
            };
            const pickedByPlayer = {};
            for (const pid of shuffledPlayers.values) {
                const inv = this.utils.toStringArray((next.players ?? []).find((p) => p.id === pid)?.inventory);
                const pick = this.random.pickOne(next.metadata ?? {}, inv);
                next = { ...next, metadata: pick.meta };
                const card = String(pick.value ?? '').trim();
                if (!card)
                    continue;
                pickedByPlayer[pid] = card;
                next = removeFromInventoryState(this.utils, next, pid, card);
            }
            const ids = shuffledPlayers.values;
            for (let i = 0; i < ids.length; i += 1) {
                const giverId = ids[i];
                const receiverId = ids[(i + 1) % ids.length];
                const card = pickedByPlayer[giverId];
                if (card) {
                    next = addCardToPlayerState(this.utils, next, receiverId, card);
                }
            }
            return this.core.appendLog(next, `[Panier Express] Échange masqué : échange réalisé.`);
        }
        if (resolvedCard === 'panier-collectif') {
            const players = state.players ?? [];
            const contributors = [];
            let pot = [];
            let next = { ...state, metadata };
            for (const p of players) {
                const inv = this.utils.toStringArray(p.inventory);
                if (!inv.length)
                    continue;
                const pick = this.random.pickOne(next.metadata ?? {}, inv);
                next = { ...next, metadata: pick.meta };
                const card = String(pick.value ?? '').trim();
                if (!card)
                    continue;
                contributors.push(p.id);
                pot.push(card);
                next = removeFromInventoryState(this.utils, next, p.id, card);
            }
            if (!pot.length || contributors.length < 2) {
                return this.core.appendLog(next, `[Panier Express] Inventaire collectif : pas assez de cartes dans le pot.`);
            }
            const shuffledPot = this.random.shuffle(next.metadata ?? {}, pot);
            next = { ...next, metadata: shuffledPot.meta };
            pot = shuffledPot.values;
            for (let i = 0; i < contributors.length; i += 1) {
                next = addCardToPlayerState(this.utils, next, contributors[i], pot[i]);
            }
            return this.core.appendLog(next, `[Panier Express] Inventaire collectif : redistribution d'inventaire effectuée.`);
        }
        if (resolvedCard === 'echange-simultane') {
            const players = state.players ?? [];
            if (players.length < 2) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] Échange simultané : aucun joueur disponible.`);
            }
            let next = { ...state, metadata };
            const toPass = [];
            for (const p of players) {
                const inv = this.utils.toStringArray(p.inventory);
                if (!inv.length)
                    continue;
                const pick = this.random.pickOne(next.metadata ?? {}, inv);
                next = { ...next, metadata: pick.meta };
                const card = String(pick.value ?? '').trim();
                if (!card)
                    continue;
                toPass.push({ from: p.id, card });
                next = removeFromInventoryState(this.utils, next, p.id, card);
            }
            for (const entry of toPass) {
                const idx = players.findIndex((p) => p.id === entry.from);
                const targetId = players[(idx + 1) % players.length].id;
                next = addCardToPlayerState(this.utils, next, targetId, entry.card);
            }
            for (const entry of toPass) {
                const idx = players.findIndex((p) => p.id === entry.from);
                const targetId = players[(idx + 1) % players.length].id;
                next = this.core.appendLog(next, `[Panier Express] Échange simultané : ${this.utils.playerName(state, entry.from)} donne "${this.utils.formatCourseLabel(entry.card)}" à ${this.utils.playerName(state, targetId)}.`);
            }
            return next;
        }
        if (resolvedCard === 'defausse-aleatoire') {
            const inventory = this.utils.toStringArray((state.players ?? []).find((p) => p.id === playerId)?.inventory);
            if (!inventory.length) {
                return this.core.appendLog({ ...state, metadata }, `[Panier Express] Défausse aléatoire : inventaire vide.`);
            }
            const metaRng = this.random.createMetaRng(metadata);
            const picked = this.random.pickOne(metaRng.getMeta(), inventory);
            const card = String(picked.value ?? '').trim();
            const updatedMeta = picked.meta;
            const players = (state.players ?? []).map((p) => {
                if (p.id !== playerId)
                    return p;
                const nextInv = this.utils.removeOne(inventory, card);
                return { ...p, inventory: nextInv };
            });
            const cardLabel = this.utils.formatCourseLabel(card);
            return this.core.appendLog(addToDiscardState({ ...state, players, metadata: updatedMeta }, card), `[Panier Express] Défausse aléatoire : ${this.utils.playerName(state, playerId)} défausse "${cardLabel}".`);
        }
        const started = this.exchangeFlow.start({ ...state, metadata }, playerId, resolvedCard, this.adapter());
        if (started.kind === 'started') {
            const pending = started.pending;
            const targetsCount = Array.isArray(pending?.targets)
                ? pending.targets.length
                : 0;
            (0, playing_logger_1.playingLog)('panier.exchange.pending', {
                roomId: state.metadata?.roomId ?? null,
                gameType: state.metadata?.gameType ?? null,
                userId: playerId,
                type: 'exchange_pending',
                playerId,
                card: resolvedCard,
                targets: targetsCount,
            });
            return started.state;
        }
        const reason = started.kind === 'no_targets'
            ? `[Panier Express] Aucun joueur disponible pour un échange (${resolvedCard}).`
            : `[Panier Express] Pas d'échange possible (${resolvedCard}).`;
        return this.core.appendLog({ ...state, metadata }, reason);
    }
    adapter() {
        return {
            listTargets: interactive_exchange_model_1.defaultExchangeTargets,
            getInventory: (state, playerId) => {
                const player = (state.players ?? []).find((p) => p.id === playerId);
                return this.utils.toStringArray(player?.inventory);
            },
            removeFromInventory: (state, playerId, card) => {
                const players = (state.players ?? []).map((p) => {
                    if (p.id !== playerId)
                        return p;
                    const inv = this.utils.toStringArray(p.inventory);
                    return { ...p, inventory: removeOne(inv, card) };
                });
                return { ...state, players };
            },
            addCardToPlayer: (state, playerId, card) => {
                return addCardToPlayerState(this.utils, state, playerId, card);
            },
            setSkipTurns: (state, playerId, turns) => setSkipTurns(state, playerId, turns),
        };
    }
};
exports.PanierExpressExchangeService = PanierExpressExchangeService;
exports.PanierExpressExchangeService = PanierExpressExchangeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [game_core_service_1.GameCoreService,
        panier_express_utils_service_1.PanierExpressUtils,
        panier_express_deck_service_1.PanierExpressDeckService,
        interactive_exchange_service_1.InteractiveExchangeService,
        panier_express_setup_service_1.PanierExpressSetupService,
        random_service_1.RandomService])
], PanierExpressExchangeService);
function removeOne(collection, value) {
    const copy = [...collection];
    const idx = copy.findIndex((entry) => entry === value);
    if (idx >= 0) {
        copy.splice(idx, 1);
    }
    return copy;
}
function addCardToPlayer(utils, player, card) {
    const trimmed = String(card ?? '').trim();
    if (!trimmed || !player) {
        return { player, kept: false, discarded: false };
    }
    const list = utils.toStringArray(player.shoppingList);
    const basket = utils.toStringArray(player.basket);
    const inventory = utils.toStringArray(player.inventory);
    const alreadyInBasket = basket.includes(trimmed);
    const alreadyInInventory = inventory.includes(trimmed);
    const isNeeded = list.includes(trimmed) && !alreadyInBasket;
    if (alreadyInBasket || alreadyInInventory) {
        if (isNeeded && alreadyInInventory) {
            return {
                player: {
                    ...player,
                    basket: [...basket, trimmed],
                    inventory: utils.removeOne(inventory, trimmed),
                },
                kept: false,
                discarded: true,
            };
        }
        return {
            player: { ...player, basket, inventory },
            kept: false,
            discarded: true,
        };
    }
    if (isNeeded) {
        return {
            player: { ...player, basket: [...basket, trimmed], inventory },
            kept: true,
            discarded: false,
        };
    }
    if (inventory.length >= 5) {
        return {
            player: { ...player, basket, inventory },
            kept: false,
            discarded: true,
        };
    }
    return {
        player: { ...player, inventory: [trimmed, ...inventory], basket },
        kept: true,
        discarded: false,
    };
}
function addCardToPlayerState(utils, state, playerId, card) {
    const trimmed = String(card ?? '').trim();
    if (!trimmed)
        return state;
    let kept = false;
    let discarded = false;
    const players = (state.players ?? []).map((p) => {
        if (p.id !== playerId)
            return p;
        const result = addCardToPlayer(utils, p, trimmed);
        kept = result.kept;
        discarded = result.discarded;
        return result.player;
    });
    const meta = (state.metadata ?? {});
    const currentDiscards = Array.isArray(meta?.discards?.courses)
        ? meta.discards.courses.map((v) => String(v))
        : [];
    return {
        ...state,
        players,
        metadata: {
            ...meta,
            lastObtainedCourse: {
                ...(meta?.lastObtainedCourse ?? {}),
                [playerId]: kept ? trimmed : null,
            },
            discards: {
                ...(meta?.discards ?? {}),
                courses: discarded ? [...currentDiscards, trimmed] : currentDiscards,
            },
        },
    };
}
function removeFromInventoryState(utils, state, playerId, card) {
    const trimmed = String(card ?? '').trim();
    if (!trimmed)
        return state;
    const players = (state.players ?? []).map((p) => {
        if (p.id !== playerId)
            return p;
        const inv = utils.toStringArray(p.inventory);
        return { ...p, inventory: removeOne(inv, trimmed) };
    });
    return { ...state, players };
}
function setInventoryState(utils, state, playerId, inventory) {
    const nextInv = utils.toStringArray(inventory);
    const players = (state.players ?? []).map((p) => {
        if (p.id !== playerId)
            return p;
        return { ...p, inventory: nextInv };
    });
    return { ...state, players };
}
function addToDiscardState(state, card) {
    const trimmed = String(card ?? '').trim();
    if (!trimmed)
        return state;
    const meta = (state.metadata ?? {});
    const current = Array.isArray(meta?.discards?.courses)
        ? meta.discards.courses.map((v) => String(v))
        : [];
    return {
        ...state,
        metadata: {
            ...meta,
            discards: {
                ...(meta?.discards ?? {}),
                courses: [...current, trimmed],
            },
        },
    };
}
function setSkipTurns(state, playerId, turns) {
    const meta = (state.metadata ?? {});
    const current = meta?.statuses?.skipTurn?.[playerId] ?? 0;
    const nextCount = Math.max(current, Math.max(1, turns || 1));
    return {
        ...state,
        metadata: {
            ...meta,
            statuses: {
                ...(meta?.statuses ?? {}),
                skipTurn: {
                    ...(meta?.statuses?.skipTurn ?? {}),
                    [playerId]: nextCount,
                },
            },
        },
    };
}
//# sourceMappingURL=panier-express-exchange.service.js.map