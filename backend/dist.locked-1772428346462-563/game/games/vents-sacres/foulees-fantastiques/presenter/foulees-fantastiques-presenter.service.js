"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "FouleesFantastiquesPresenterService", {
    enumerable: true,
    get: function() {
        return FouleesFantastiquesPresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _boardpayloadservice = require("../../../../modules/board/services/board-payload.service");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
const _gamedefinition = require("../definitions/game.definition");
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let FouleesFantastiquesPresenterService = class FouleesFantastiquesPresenterService {
    exposeStateForUser(state, userId) {
        const actions = _rulebook.getAvailableActions(state, userId);
        const meta = state.metadata ?? {};
        const arrivalProgress = (meta.trackLength ?? 0) + (meta.homeLength ?? 0) - 1;
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p)=>p?.id === userId);
        const scoreLines = players.map((p)=>{
            const name = typeof p?.username === 'string' && p.username.trim().length > 0 ? p.username.trim() : `Joueur ${p?.id ?? '?'}`;
            const pid = p?.id ?? -1;
            const pawns = Array.isArray(meta.pawnsByPlayer?.[pid]) ? meta.pawnsByPlayer[pid] : [];
            const arrived = pawns.filter((pawn)=>(pawn?.progress ?? -1) >= arrivalProgress).length;
            return `${name} : ${arrived} arrivé${arrived > 1 ? 's' : ''}`;
        });
        const myPawns = Array.isArray(meta.pawnsByPlayer?.[userId]) ? meta.pawnsByPlayer[userId] : [];
        const myColor = meta.colorsByPlayer?.[userId];
        const inStable = myPawns.filter((p)=>(p?.progress ?? -1) < 0).length;
        const inHome = myPawns.filter((p)=>typeof p?.progress === 'number' && p.progress >= meta.trackLength && p.progress < arrivalProgress).length;
        const finished = myPawns.filter((p)=>(p?.progress ?? -1) >= arrivalProgress).length;
        const out = myPawns.filter((p)=>typeof p?.progress === 'number' && p.progress >= 0 && p.progress < meta.trackLength);
        const stableLines = [];
        if (myColor) stableLines.push(`Couleur: ${myColor}.`);
        stableLines.push(`Départ: ${inStable}/4.`);
        stableLines.push(`Abri: ${inHome}/4.`);
        stableLines.push(`Arrivés: ${finished}/4.`);
        if (out.length) {
            const offset = meta.offsets?.[userId] ?? 0;
            const names = meta?.pawnNamesByPlayer?.[userId];
            for (const pawn of out){
                const pos = (offset + pawn.progress) % meta.trackLength;
                const label = Array.isArray(names) && typeof names[pawn.pawnIndex] === 'string' ? String(names[pawn.pawnIndex]).trim() : `animal ${pawn.pawnIndex + 1}`;
                stableLines.push(`${label}: case ${pos + 1}/${meta.trackLength}.`);
            }
        } else {
            stableLines.push('Aucun animal sorti.');
        }
        const positionLines = [];
        const allOnTrack = [];
        for (const p of players){
            if (!p) continue;
            const offset = meta.offsets?.[p.id] ?? 0;
            const names = meta?.pawnNamesByPlayer?.[p.id];
            const pawns = Array.isArray(meta.pawnsByPlayer?.[p.id]) ? meta.pawnsByPlayer[p.id] : [];
            for (const pawn of pawns){
                const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
                if (prog < 0 || prog >= meta.trackLength) continue;
                const pos = (offset + prog) % meta.trackLength;
                const label = Array.isArray(names) && typeof names[pawn.pawnIndex] === 'string' ? String(names[pawn.pawnIndex]).trim() : `animal ${pawn.pawnIndex + 1}`;
                allOnTrack.push({
                    pos,
                    line: `${label}, tour 0, case ${pos + 1}/${meta.trackLength}.`
                });
            }
        }
        allOnTrack.sort((a, b)=>b.pos - a.pos);
        positionLines.push(...allOnTrack.map((x)=>x.line));
        if (!positionLines.length) {
            positionLines.push('Aucun animal sorti.');
        }
        const extras = {
            ...state.extras,
            currentPlayerView: {
                id: userId,
                username: me?.username ?? `Joueur ${userId}`,
                stable: stableLines,
                position: positionLines
            },
            ui: {
                panels: {
                    stable: {
                        title: 'État',
                        message: stableLines.length ? stableLines.join(' ') : 'État: inconnu.'
                    },
                    position: {
                        title: 'Position',
                        message: positionLines.length ? positionLines.join(' ') : this.boardPayload.buildPositionPanelMessage({
                            tilesRaw: meta.tiles,
                            positionsRaw: meta.positions,
                            lapsRaw: meta.laps,
                            playerId: userId
                        })
                    },
                    score: {
                        title: 'Scores',
                        message: scoreLines.length ? scoreLines.join('\n') : 'Scores: indisponibles.'
                    }
                }
            }
        };
        // Ne pas exposer le pending (liste de choix) aux autres joueurs :
        // c'est une décision à prendre uniquement par `pending.playerId`.
        const pendingForUser = state.pending && typeof state.pending?.playerId === 'number' ? state.pending.playerId === userId ? state.pending : null : state.pending ?? null;
        return {
            ...state,
            catalog: {
                phases: _gamedefinition.FOULEES_FANTASTIQUES_GAME.phaseOrder.map((p)=>p.id),
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions),
            pending: pendingForUser,
            extras,
            board: this.boardPayload.buildTilesPositionsLaps(meta.tiles, meta.positions, meta.laps)
        };
    }
    constructor(boardPayload){
        this.boardPayload = boardPayload;
    }
};
FouleesFantastiquesPresenterService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _boardpayloadservice.BoardPayloadService === "undefined" ? Object : _boardpayloadservice.BoardPayloadService
    ])
], FouleesFantastiquesPresenterService);
