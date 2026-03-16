"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "CorridorSetupService", {
    enumerable: true,
    get: function() {
        return CorridorSetupService;
    }
});
const _common = require("@nestjs/common");
const _gamedefinition = require("../definitions/game.definition");
const _corridorpawns = require("../definitions/corridor.pawns");
const _seededrng = require("../../../../../common/utils/seeded-rng");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let CorridorSetupService = class CorridorSetupService {
    hydrateInitialState(baseState) {
        const status = String(baseState.status ?? '').toLowerCase().trim();
        if (status !== 'started') {
            return {
                ...baseState,
                metadata: {
                    ...baseState.metadata ?? {},
                    size: _gamedefinition.CORRIDOR_GAME.boardSize,
                    winnerPlayerId: null
                }
            };
        }
        const players = baseState.players ?? [];
        if (players.length < _gamedefinition.CORRIDOR_GAME.minPlayers) {
            throw new Error('Nombre de joueurs insuffisant pour demarrer Le Corridor.');
        }
        const size = _gamedefinition.CORRIDOR_GAME.boardSize;
        const p1 = players[0];
        const p2 = players[1];
        const startX = Math.floor(size / 2);
        const pawnChoices = _corridorpawns.CORRIDOR_PAWNS.map((p)=>({
                id: p.id,
                label: p.label,
                description: p.description
            }));
        const baseMeta = baseState.metadata && typeof baseState.metadata === 'object' ? baseState.metadata : {};
        const pawnByPlayerId = {};
        const usedPawnIds = new Set();
        const log = [
            ...baseState.log ?? []
        ];
        for (const bot of players.filter((p)=>p?.isBot === true)){
            const pick = pawnChoices.find((pawn)=>!usedPawnIds.has(pawn.id));
            if (!pick) break;
            pawnByPlayerId[String(bot.id)] = pick.id;
            usedPawnIds.add(pick.id);
            log.push({
                message: `${bot.username} choisit ${pick.label}.`,
                timestamp: new Date().toISOString()
            });
        }
        const eligible = players.filter((p)=>p?.isBot !== true && !pawnByPlayerId[String(p?.id ?? '')]);
        const pick = eligible.length > 1 ? (0, _seededrng.nextRngInt)(baseMeta, eligible.length) : null;
        const pendingPlayerId = eligible.length <= 0 ? null : eligible.length === 1 ? eligible[0].id ?? null : eligible[pick.value]?.id ?? eligible[0].id ?? null;
        const metaAfterPick = pick?.meta ?? baseMeta;
        const metadata = {
            size,
            setupStarterId: p1.id,
            pawns: pawnChoices,
            pawnByPlayerId,
            pawnsByPlayerId: {
                [String(p1.id)]: {
                    x: startX,
                    y: 0
                },
                [String(p2.id)]: {
                    x: startX,
                    y: size - 1
                }
            },
            goalYByPlayerId: {
                [String(p1.id)]: size - 1,
                [String(p2.id)]: 0
            },
            walls: {
                h: [],
                v: []
            },
            wallsRemainingByPlayerId: {
                [String(p1.id)]: _gamedefinition.CORRIDOR_GAME.wallsPerPlayer,
                [String(p2.id)]: _gamedefinition.CORRIDOR_GAME.wallsPerPlayer
            },
            winnerPlayerId: null,
            winnerId: null
        };
        const pendingChoices = pawnChoices.filter((pawn)=>!usedPawnIds.has(pawn.id)).map((pawn)=>({
                id: pawn.id,
                label: `${pawn.label} - ${pawn.description}`,
                description: pawn.description
            }));
        return {
            ...baseState,
            phase: 'play',
            round: 1,
            turnIndex: 0,
            lastRoll: null,
            metadata: {
                ...metaAfterPick,
                ...metadata
            },
            pending: pendingPlayerId != null ? {
                type: 'choose_pawn',
                label: 'Votre pion.',
                playerId: pendingPlayerId,
                blocking: true,
                data: {
                    pawns: pendingChoices
                }
            } : null,
            log,
            turn: {
                currentPlayerId: pendingPlayerId ?? p1.id,
                direction: 1,
                label: pendingPlayerId != null ? 'Choix du pion' : `Tour de ${p1.username}`
            }
        };
    }
};
CorridorSetupService = _ts_decorate([
    (0, _common.Injectable)()
], CorridorSetupService);
