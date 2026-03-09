"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PanierExpressUtils", {
    enumerable: true,
    get: function() {
        return PanierExpressUtils;
    }
});
const _common = require("@nestjs/common");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let PanierExpressUtils = class PanierExpressUtils {
    playerName(state, playerId) {
        const player = state.players?.find((p)=>p.id === playerId);
        const username = typeof player?.username === 'string' ? player.username.trim() : '';
        return username.length ? username : `Joueur ${playerId}`;
    }
    getPlayerName(state, playerId) {
        return this.playerName(state, playerId);
    }
    getPlayer(state, playerId) {
        const player = state.players?.find((p)=>p.id === playerId);
        if (!player) return null;
        return this.normalizePlayer(player);
    }
    normalizePlayer(player) {
        return {
            id: player.id,
            username: typeof player.username === 'string' ? player.username : `Joueur ${player.id}`,
            isBot: player.isBot === true,
            shoppingList: this.toStringArray(player.shoppingList),
            basket: this.toStringArray(player.basket),
            inventory: this.toStringArray(player.inventory),
            pawn: typeof player.pawn === 'string' ? player.pawn : undefined
        };
    }
    normalizePlayers(players) {
        if (!Array.isArray(players)) return [];
        return players.map((p)=>this.normalizePlayer(p));
    }
    toStringArray(value) {
        if (Array.isArray(value)) {
            return value.map((entry)=>entry == null ? '' : String(entry)).filter((entry)=>entry.length > 0);
        }
        if (typeof value === 'string') {
            try {
                const parsed = JSON.parse(value);
                if (Array.isArray(parsed)) {
                    return parsed.map((entry)=>entry == null ? '' : String(entry)).filter((entry)=>entry.length > 0);
                }
            } catch  {
            // ignore
            }
            return value.split(/[,;]+/).map((v)=>v.trim()).filter((v)=>v.length > 0);
        }
        return [];
    }
    missingShoppingItems(player) {
        if (!player) return new Set();
        const basket = Array.isArray(player.basket) ? player.basket.map((item)=>String(item)) : [];
        const shoppingList = this.toStringArray(player.shoppingList);
        return new Set(shoppingList.filter((item)=>!basket.includes(item)));
    }
    getMissingItems(player) {
        return new Set(player.shoppingList.filter((item)=>!player.basket.includes(item)));
    }
    hasCompletedShopping(player) {
        return player.shoppingList.length > 0 && player.shoppingList.every((item)=>player.basket.includes(item));
    }
    isBot(player) {
        const username = String(player?.username ?? '').toLowerCase();
        return player?.isBot === true || username.includes('bot');
    }
    isGameInProgress(state) {
        const status = String(state.status ?? '').toLowerCase();
        const players = state.players ?? [];
        return status === 'finished' || typeof state.turnIndex === 'number' && state.turnIndex > 0 || players.some((p)=>{
            const hasList = Array.isArray(p.shoppingList) && p.shoppingList.length > 0;
            const hasBasket = Array.isArray(p.basket) && p.basket.length > 0;
            const hasInventory = Array.isArray(p.inventory) && p.inventory.length > 0;
            return hasList || hasBasket || hasInventory;
        });
    }
    removeOne(arr, value) {
        const copy = Array.isArray(arr) ? [
            ...arr
        ] : [];
        const idx = copy.findIndex((v)=>v === value);
        if (idx >= 0) copy.splice(idx, 1);
        return copy;
    }
    formatCourseLabel(courseId) {
        const raw = typeof courseId === 'string' ? courseId.trim() : '';
        if (!raw) return '';
        return PanierExpressUtils.COURSE_LABELS[raw] ?? raw;
    }
    formatCourseLabels(list) {
        if (!list) return [];
        return Array.from(list).map((v)=>this.formatCourseLabel(v)).filter((s)=>s.length > 0);
    }
    formatEventLabel(eventId) {
        const raw = typeof eventId === 'string' ? eventId.trim() : '';
        if (!raw) return '';
        const direct = PanierExpressUtils.EVENT_LABELS[raw];
        if (direct) return direct;
        const tokenMap = {
            echange: 'échange',
            journee: 'journée',
            marche: 'marché',
            intemperie: 'intempérie',
            avarie: 'avarié',
            controle: 'contrôle',
            ephemere: 'éphémère',
            fidelite: 'fidélité',
            abime: 'abîmé',
            detrempe: 'détrempé',
            derriere: 'derrière',
            impose: 'imposé',
            perce: 'percé',
            spontane: 'spontané',
            genereux: 'généreux',
            improvise: 'improvisé'
        };
        const extraTokenMap = {
            recompensee: 'r\u00e9compens\u00e9e',
            inversee: 'invers\u00e9e',
            fete: 'f\u00eate',
            ferme: 'ferm\u00e9',
            bonde: 'bond\u00e9',
            defectueux: 'd\u00e9fectueux',
            oublie: 'oubli\u00e9',
            anime: 'animé',
            spontanee: 'spontanée'
        };
        const words = raw.split('-').map((token)=>tokenMap[token] ?? extraTokenMap[token] ?? token).filter((t)=>t.length > 0);
        if (!words.length) return raw;
        const label = words.join(' ');
        return label.charAt(0).toUpperCase() + label.slice(1);
    }
    getTileLabel(tile) {
        if (!tile) return 'inconnu';
        switch(tile.type){
            case 'start':
                return 'départ';
            case 'rest':
                return 'repos';
            case 'stand':
                return `stand ${tile.standId ?? 'inconnu'}`;
            case 'event':
                return 'événement';
            case 'exchange':
                return 'échange';
            case 'quiz':
                return 'quiz';
            case 'move':
                return 'avancer ou reculer';
            case 'move_to_stand':
                return "avance jusqu'au prochain stand";
            case 'skip':
                return 'perd un tour';
            case 'bonus_course':
                return 'pioche course bonus';
            default:
                return tile?.id ?? 'inconnu';
        }
    }
};
PanierExpressUtils.COURSE_LABELS = {
    cepe: 'cèpe',
    'celeri-branche': 'céleri-branche',
    chataigne: 'châtaigne',
    clementine: 'clémentine',
    echalote: 'échalote',
    epinard: 'épinard',
    feve: 'fève',
    'jeune-pousse-d-ortie': "jeune pousse d'ortie",
    mais: 'maïs',
    mure: 'mûre',
    nefle: 'nèfle',
    patisson: 'pâtisson',
    peche: 'pêche',
    'pois-casse': 'pois cassés'
};
PanierExpressUtils.EVENT_LABELS = {
    'produit-avarie': 'Produit avarié',
    'producteur-genereux': 'Producteur généreux',
    'troc-improvise': 'Troc improvisé'
};
PanierExpressUtils = _ts_decorate([
    (0, _common.Injectable)()
], PanierExpressUtils);
