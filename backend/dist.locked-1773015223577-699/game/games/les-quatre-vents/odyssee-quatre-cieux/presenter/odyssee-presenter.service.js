"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "OdysseePresenterService", {
    enumerable: true,
    get: function() {
        return OdysseePresenterService;
    }
});
const _common = require("@nestjs/common");
const _actionspresenterhelper = require("../../../../presenters/actions-presenter.helper");
const _odysseedefinition = require("../definitions/odyssee.definition");
const _rulebook = /*#__PURE__*/ _interop_require_wildcard(require("../rulebook/rulebook"));
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
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
let OdysseePresenterService = class OdysseePresenterService {
    exposeStateForUser(state, userId) {
        const actions = _rulebook.getAvailableActions(state, userId);
        const meta = state.metadata ?? {};
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p)=>p?.id === userId);
        const trackLength = meta.trackLength ?? 0;
        const homeLength = meta.homeLength ?? 0;
        const arrivalProgress = trackLength + homeLength - 1;
        const myPawns = Array.isArray(meta.pawnsByPlayer?.[userId]) ? meta.pawnsByPlayer[userId] : [];
        const inBase = myPawns.filter((p)=>(p?.progress ?? -1) < 0).length;
        const inHangar = myPawns.filter((p)=>typeof p?.progress === 'number' && p.progress >= trackLength && p.progress < arrivalProgress).length;
        const finished = myPawns.filter((p)=>(p?.progress ?? -1) >= arrivalProgress).length;
        const onTrack = myPawns.filter((p)=>typeof p?.progress === 'number' && p.progress >= 0 && p.progress < trackLength);
        const stableLines = [];
        stableLines.push('Couleur: inconnue.');
        stableLines.push(`Base: ${inBase}/4.`);
        stableLines.push(`Hangar: ${inHangar}/4.`);
        stableLines.push(`Arrivée: ${finished}/4.`);
        if (onTrack.length) {
            const parts = onTrack.map((p)=>`Pion ${p.pawnIndex + 1}: ${p.progress}`).join(', ');
            stableLines.push(`Positions: ${parts}.`);
        } else {
            stableLines.push('Positions: aucune.');
        }
        const scoreLines = players.map((p)=>{
            const name = typeof p?.username === 'string' && p.username.trim().length > 0 ? p.username.trim() : `Joueur ${p?.id ?? '?'}`;
            const pid = p?.id ?? -1;
            const pawns = Array.isArray(meta.pawnsByPlayer?.[pid]) ? meta.pawnsByPlayer[pid] : [];
            const done = pawns.filter((pawn)=>(pawn?.progress ?? -1) >= arrivalProgress).length;
            return `${name} : ${done} arrivé${done > 1 ? 's' : ''}`;
        });
        return {
            ...state,
            catalog: {
                phases: _odysseedefinition.ODYSSEE_GAME.phaseOrder.map((p)=>p.id),
                victory: null
            },
            actions: (0, _actionspresenterhelper.formatPresenterActions)(actions),
            pending: state.pending ?? null,
            extras: {
                ...asRecord(state.extras),
                currentPlayerView: {
                    id: userId,
                    username: me?.username ?? `Joueur ${userId}`
                },
                ui: {
                    panels: {
                        position: {
                            title: 'Position',
                            message: (()=>{
                                const pawns = Array.isArray(meta.pawnsByPlayer?.[userId]) ? meta.pawnsByPlayer[userId] : [];
                                if (pawns.length === 0) return 'Position: inconnue.';
                                const parts = pawns.filter((p)=>p && typeof p.pawnIndex === 'number' && typeof p.progress === 'number').map((p)=>`Pion ${p.pawnIndex + 1}: ${p.progress}`);
                                if (parts.length === 0) return 'Position: inconnue.';
                                return `Pions: ${parts.join(', ')}.`;
                            })()
                        },
                        stable: {
                            title: 'État',
                            message: stableLines.join(' ')
                        },
                        score: {
                            title: 'Scores',
                            message: scoreLines.length ? scoreLines.join('\n') : 'Scores: indisponibles.'
                        }
                    }
                }
            },
            board: {
                trackLength: meta.trackLength,
                homeLength: meta.homeLength,
                offsets: meta.offsets ?? {},
                pawnsByPlayer: meta.pawnsByPlayer ?? {}
            }
        };
    }
};
OdysseePresenterService = _ts_decorate([
    (0, _common.Injectable)()
], OdysseePresenterService);
