"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OdysseePresenterService = void 0;
const common_1 = require("@nestjs/common");
const actions_presenter_helper_1 = require("../../../../presenters/actions-presenter.helper");
const odyssee_definition_1 = require("../definitions/odyssee.definition");
const Rulebook = __importStar(require("../rulebook/rulebook"));
function asRecord(value) {
    return value != null && typeof value === 'object'
        ? value
        : {};
}
let OdysseePresenterService = class OdysseePresenterService {
    exposeStateForUser(state, userId) {
        const actions = Rulebook.getAvailableActions(state, userId);
        const meta = (state.metadata ?? {});
        const players = Array.isArray(state.players) ? state.players : [];
        const me = players.find((p) => p?.id === userId);
        const trackLength = meta.trackLength ?? 0;
        const homeLength = meta.homeLength ?? 0;
        const arrivalProgress = trackLength + homeLength - 1;
        const myPawns = Array.isArray(meta.pawnsByPlayer?.[userId])
            ? meta.pawnsByPlayer[userId]
            : [];
        const inBase = myPawns.filter((p) => (p?.progress ?? -1) < 0).length;
        const inHangar = myPawns.filter((p) => typeof p?.progress === 'number' &&
            p.progress >= trackLength &&
            p.progress < arrivalProgress).length;
        const finished = myPawns.filter((p) => (p?.progress ?? -1) >= arrivalProgress).length;
        const onTrack = myPawns.filter((p) => typeof p?.progress === 'number' &&
            p.progress >= 0 &&
            p.progress < trackLength);
        const stableLines = [];
        stableLines.push('Couleur: inconnue.');
        stableLines.push(`Base: ${inBase}/4.`);
        stableLines.push(`Hangar: ${inHangar}/4.`);
        stableLines.push(`Arrivée: ${finished}/4.`);
        if (onTrack.length) {
            const parts = onTrack
                .map((p) => `Pion ${p.pawnIndex + 1}: ${p.progress}`)
                .join(', ');
            stableLines.push(`Positions: ${parts}.`);
        }
        else {
            stableLines.push('Positions: aucune.');
        }
        const scoreLines = players.map((p) => {
            const name = typeof p?.username === 'string' && p.username.trim().length > 0
                ? p.username.trim()
                : `Joueur ${p?.id ?? '?'}`;
            const pid = p?.id ?? -1;
            const pawns = Array.isArray(meta.pawnsByPlayer?.[pid])
                ? meta.pawnsByPlayer[pid]
                : [];
            const done = pawns.filter((pawn) => (pawn?.progress ?? -1) >= arrivalProgress).length;
            return `${name} : ${done} arrivé${done > 1 ? 's' : ''}`;
        });
        return {
            ...state,
            catalog: {
                phases: odyssee_definition_1.ODYSSEE_GAME.phaseOrder.map((p) => p.id),
                victory: null,
            },
            actions: (0, actions_presenter_helper_1.formatPresenterActions)(actions),
            pending: state.pending ?? null,
            extras: {
                ...asRecord(state.extras),
                currentPlayerView: {
                    id: userId,
                    username: me?.username ?? `Joueur ${userId}`,
                },
                ui: {
                    panels: {
                        position: {
                            title: 'Position',
                            message: (() => {
                                const pawns = Array.isArray(meta.pawnsByPlayer?.[userId])
                                    ? meta.pawnsByPlayer[userId]
                                    : [];
                                if (pawns.length === 0)
                                    return 'Position: inconnue.';
                                const parts = pawns
                                    .filter((p) => p &&
                                    typeof p.pawnIndex === 'number' &&
                                    typeof p.progress === 'number')
                                    .map((p) => `Pion ${p.pawnIndex + 1}: ${p.progress}`);
                                if (parts.length === 0)
                                    return 'Position: inconnue.';
                                return `Pions: ${parts.join(', ')}.`;
                            })(),
                        },
                        stable: {
                            title: 'État',
                            message: stableLines.join(' '),
                        },
                        score: {
                            title: 'Scores',
                            message: scoreLines.length
                                ? scoreLines.join('\n')
                                : 'Scores: indisponibles.',
                        },
                    },
                },
            },
            board: {
                trackLength: meta.trackLength,
                homeLength: meta.homeLength,
                offsets: meta.offsets ?? {},
                pawnsByPlayer: meta.pawnsByPlayer ?? {},
            },
        };
    }
};
exports.OdysseePresenterService = OdysseePresenterService;
exports.OdysseePresenterService = OdysseePresenterService = __decorate([
    (0, common_1.Injectable)()
], OdysseePresenterService);
//# sourceMappingURL=odyssee-presenter.service.js.map