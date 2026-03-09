"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "NawakSetupService", {
    enumerable: true,
    get: function() {
        return NawakSetupService;
    }
});
const _common = require("@nestjs/common");
const _setupservicehelper = require("../../../../setup/setup-service.helper");
const _nawakchallengeservice = require("../data/nawak-challenge.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let NawakSetupService = class NawakSetupService {
    hydrateInitialState(baseState) {
        const players = (0, _setupservicehelper.getSafePlayers)(baseState);
        const playerIds = players.filter((player)=>typeof player?.id === 'number').map((player)=>player.id);
        const metaSeed = baseState.metadata ?? {};
        const initialScores = {};
        playerIds.forEach((pid)=>{
            initialScores[pid] = metaSeed.scores?.[pid] ?? 0;
        });
        const targetScore = Math.max(1, Number(metaSeed.targetScore ?? 5));
        const meta = {
            rng: metaSeed.rng ?? {},
            targetScore,
            scores: initialScores,
            currentChallenge: {
                id: '',
                prompt: '',
                answers: [
                    '',
                    '',
                    ''
                ]
            },
            roundStage: 'choose',
            submissions: {},
            votes: {},
            lastRound: null,
            winnerId: null
        };
        const { challenge, meta: withChallenge } = this.challengeService.loadChallenge(meta);
        const metadata = {
            ...withChallenge,
            targetScore,
            scores: initialScores,
            currentChallenge: challenge,
            roundStage: 'choose',
            submissions: {},
            votes: {},
            lastRound: null,
            winnerId: null
        };
        return {
            ...baseState,
            metadata
        };
    }
    constructor(challengeService){
        this.challengeService = challengeService;
    }
};
NawakSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _nawakchallengeservice.NawakChallengeService === "undefined" ? Object : _nawakchallengeservice.NawakChallengeService
    ])
], NawakSetupService);
