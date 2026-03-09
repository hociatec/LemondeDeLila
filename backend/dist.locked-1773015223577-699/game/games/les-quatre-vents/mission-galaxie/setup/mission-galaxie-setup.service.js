"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "MissionGalaxieSetupService", {
    enumerable: true,
    get: function() {
        return MissionGalaxieSetupService;
    }
});
const _common = require("@nestjs/common");
const _gamecontentloaderservice = require("../../../../engine/services/game-content-loader.service");
const _randomservice = require("../../../../modules/random/services/random.service");
const _contentloaderhelper = require("../../../../setup/content-loader.helper");
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
let MissionGalaxieSetupService = class MissionGalaxieSetupService {
    hydrateInitialState(base) {
        const board = this.loadBoard();
        const questions = this.loadQuestions();
        const challenges = this.loadChallenges();
        const events = this.loadEvents();
        const players = Array.isArray(base.players) ? base.players : [];
        const positions = {};
        const statuses = {
            skipTurn: {}
        };
        for (const player of players){
            if (player?.id != null) {
                positions[player.id] = 0;
                statuses.skipTurn[player.id] = 0;
            }
        }
        const seedMeta = asRecord(base.metadata);
        const shuffledQuestions = this.random.shuffle(seedMeta, questions.questions ?? []);
        const shuffledChallenges = this.random.shuffle(shuffledQuestions.meta ?? seedMeta, challenges.challenges ?? []);
        const shuffledEvents = this.random.shuffle(shuffledChallenges.meta ?? seedMeta, events.events ?? []);
        const meta = {
            tiles: board.tiles ?? [],
            positions,
            statuses,
            decks: {
                questions: shuffledQuestions.values,
                challenges: shuffledChallenges.values,
                events: shuffledEvents.values
            },
            discards: {
                questions: [],
                challenges: [],
                events: []
            },
            pendingContext: null,
            winnerId: null
        };
        return {
            ...base,
            phase: 'playing',
            pending: null,
            metadata: {
                ...base.metadata ?? {},
                ...shuffledQuestions.meta ?? {},
                ...shuffledChallenges.meta ?? {},
                ...shuffledEvents.meta ?? {},
                ...meta
            }
        };
    }
    loadBoard() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'mission-galaxie',
            baseDir: __dirname,
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1
        });
    }
    loadQuestions() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'mission-galaxie',
            baseDir: __dirname,
            filename: 'questions.json',
            arrayField: 'questions',
            minItems: 1
        });
    }
    loadChallenges() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'mission-galaxie',
            baseDir: __dirname,
            filename: 'challenges.json',
            arrayField: 'challenges',
            minItems: 1
        });
    }
    loadEvents() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'mission-galaxie',
            baseDir: __dirname,
            filename: 'events.json',
            arrayField: 'events',
            minItems: 1
        });
    }
    constructor(contentLoader, random){
        this.contentLoader = contentLoader;
        this.random = random;
    }
};
MissionGalaxieSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _gamecontentloaderservice.GameContentLoaderService === "undefined" ? Object : _gamecontentloaderservice.GameContentLoaderService,
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], MissionGalaxieSetupService);
