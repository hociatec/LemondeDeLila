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
exports.NawakSetupService = void 0;
const common_1 = require("@nestjs/common");
const setup_service_helper_1 = require("../../../../setup/setup-service.helper");
const nawak_challenge_service_1 = require("../data/nawak-challenge.service");
let NawakSetupService = class NawakSetupService {
    challengeService;
    constructor(challengeService) {
        this.challengeService = challengeService;
    }
    hydrateInitialState(baseState) {
        const players = (0, setup_service_helper_1.getSafePlayers)(baseState);
        const playerIds = players
            .filter((player) => typeof player?.id === 'number')
            .map((player) => player.id);
        const metaSeed = (baseState.metadata ?? {});
        const initialScores = {};
        playerIds.forEach((pid) => {
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
                answers: ['', '', ''],
            },
            roundStage: 'choose',
            submissions: {},
            votes: {},
            lastRound: null,
            winnerId: null,
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
            winnerId: null,
        };
        return {
            ...baseState,
            metadata,
        };
    }
};
exports.NawakSetupService = NawakSetupService;
exports.NawakSetupService = NawakSetupService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nawak_challenge_service_1.NawakChallengeService])
], NawakSetupService);
//# sourceMappingURL=nawak-setup.service.js.map