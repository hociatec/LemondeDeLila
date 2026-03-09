"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PanierExpressDrawService", {
    enumerable: true,
    get: function() {
        return PanierExpressDrawService;
    }
});
const _common = require("@nestjs/common");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _panierexpresssetupservice = require("../setup/panier-express-setup.service");
const _playinglogger = require("../../../../../common/utils/playing-logger");
const _panierexpressutilsservice = require("../model/panier-express-utils.service");
const _panierexpressdeckservice = require("./panier-express-deck.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let PanierExpressDrawService = class PanierExpressDrawService {
    drawCourse(state, playerId, standId) {
        const meta = state.metadata;
        const noDraw = meta?.statuses?.noDrawCourses?.[playerId] ?? 0;
        if (noDraw > 0) {
            return this.core.appendLog(state, `[Panier Express] ${this.utils.playerName(state, playerId)} ne peut pas piocher de carte ce tour-ci.`);
        }
        const decks = meta.decks ?? this.setup.buildDeckPool(state);
        let metaAfter = {
            ...meta,
            decks
        };
        const resolvedStandId = standId ?? this.findStandAtPosition(meta, playerId);
        const standKey = resolvedStandId ? `courses-${resolvedStandId}` : 'courses';
        const draw = this.drawAtStand(metaAfter, standKey, resolvedStandId);
        metaAfter = draw.metadata;
        if (!draw.card) {
            const debugLabel = resolvedStandId ? standKey : 'courses';
            return this.core.appendLog(state, `[Panier Express] Stand ${resolvedStandId || 'inconnu'} : aucune carte disponible (deck ${debugLabel}).`);
        }
        const { card, metadata } = draw;
        let discarded = null;
        let duplicateSource = null;
        let kept = false;
        const players = (state.players ?? []).map((player)=>{
            if (player.id !== playerId) return player;
            const shoppingList = this.utils.toStringArray(player.shoppingList);
            const basket = this.utils.toStringArray(player.basket);
            const inventory = this.utils.toStringArray(player.inventory);
            const alreadyInBasket = basket.includes(card);
            const alreadyInInventory = inventory.includes(card);
            const isNeeded = shoppingList.includes(card) && !alreadyInBasket;
            if (alreadyInBasket) {
                discarded = 'duplicate';
                duplicateSource = 'panier';
                return {
                    ...player,
                    inventory,
                    basket
                };
            }
            if (isNeeded) {
                kept = true;
                if (alreadyInInventory) {
                    discarded = 'duplicate';
                    duplicateSource = 'inventaire';
                    return {
                        ...player,
                        basket: [
                            ...basket,
                            card
                        ],
                        inventory: this.utils.removeOne(inventory, card)
                    };
                }
                return {
                    ...player,
                    basket: [
                        ...basket,
                        card
                    ],
                    inventory
                };
            }
            if (alreadyInInventory) {
                discarded = 'duplicate';
                duplicateSource = 'inventaire';
                return {
                    ...player,
                    inventory,
                    basket
                };
            }
            if (inventory.length >= PanierExpressDrawService.MAX_INVENTORY) {
                discarded = 'full';
                return {
                    ...player,
                    inventory,
                    basket
                };
            }
            kept = true;
            return {
                ...player,
                inventory: [
                    ...inventory,
                    card
                ],
                basket
            };
        });
        const nextMeta = {
            ...metadata,
            lastObtainedCourse: {
                ...metadata?.lastObtainedCourse ?? {},
                [playerId]: kept ? card : null
            },
            discards: discarded && card ? {
                ...metadata?.discards ?? {},
                courses: [
                    ...metadata?.discards?.courses ?? [] ?? [],
                    card
                ]
            } : metadata?.discards ?? {
                courses: []
            }
        };
        const nextState = {
            ...state,
            players,
            metadata: nextMeta
        };
        const courseLabel = this.utils.formatCourseLabel(card);
        const playerLabel = this.utils.playerName(state, playerId);
        const message = discarded ? discarded === 'duplicate' ? duplicateSource === 'panier' ? `[Panier Express] ${playerLabel} pioche "${courseLabel}" mais l'a déjà dans le panier. Cet ingrédient part donc à la défausse.` : duplicateSource === 'inventaire' ? `[Panier Express] ${playerLabel} pioche "${courseLabel}" mais l'a déjà dans l'inventaire. Cet ingrédient part donc à la défausse.` : `[Panier Express] ${playerLabel} pioche "${courseLabel}" mais l'a déjà. Cet ingrédient part donc à la défausse.` : `[Panier Express] ${playerLabel} pioche "${courseLabel}" mais l'inventaire est plein. Cet ingrédient part donc à la défausse.` : `[Panier Express] ${playerLabel} pioche "${courseLabel}".`;
        const logged = this.core.appendLog(nextState, message);
        const playerView = players.find((p)=>p.id === playerId);
        (0, _playinglogger.playingLog)('panier.draw', {
            roomId: state.metadata?.roomId ?? null,
            gameType: state.metadata?.gameType ?? null,
            userId: playerId,
            type: 'draw',
            playerId,
            card,
            standId: resolvedStandId || null,
            shoppingList: playerView?.shoppingList ?? [],
            basket: playerView?.basket ?? [],
            inventory: playerView?.inventory ?? [],
            discarded
        });
        return logged;
    }
    drawAtStand(meta, standKey, standId) {
        if (standId) {
            const replenish = ()=>this.setup.buildReplenishableDeck(this.setup.standCourseMap()[standId] ?? this.setup.courseItems());
            const draw = this.deckHelper.drawWithReplenish(meta, standKey, replenish);
            if (draw.card) {
                return draw;
            }
            return this.deckHelper.drawWithReplenish(draw.metadata, 'courses', ()=>this.setup.buildReplenishableDeck());
        }
        return this.deckHelper.drawWithReplenish(meta, 'courses', ()=>this.setup.buildReplenishableDeck());
    }
    findStandAtPosition(meta, playerId) {
        const pos = meta.positions?.[playerId] ?? 0;
        const tile = meta.tiles?.[pos];
        return tile?.type === 'stand' ? tile.standId : undefined;
    }
    constructor(setup, core, utils, deckHelper){
        this.setup = setup;
        this.core = core;
        this.utils = utils;
        this.deckHelper = deckHelper;
    }
};
PanierExpressDrawService.MAX_INVENTORY = 5;
PanierExpressDrawService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _panierexpresssetupservice.PanierExpressSetupService === "undefined" ? Object : _panierexpresssetupservice.PanierExpressSetupService,
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _panierexpressutilsservice.PanierExpressUtils === "undefined" ? Object : _panierexpressutilsservice.PanierExpressUtils,
        typeof _panierexpressdeckservice.PanierExpressDeckService === "undefined" ? Object : _panierexpressdeckservice.PanierExpressDeckService
    ])
], PanierExpressDrawService);
