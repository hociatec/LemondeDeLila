"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "NawakChallengeService", {
    enumerable: true,
    get: function() {
        return NawakChallengeService;
    }
});
const _common = require("@nestjs/common");
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
const _randomservice = require("../../../../modules/random/services/random.service");
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
let NawakChallengeService = class NawakChallengeService {
    loadChallenge(meta) {
        if (!this.challenges.length) {
            throw new Error('Pas de défi disponible pour Nawak !');
        }
        const seed = meta.rng ?? {};
        const { index, meta: rngMeta } = this.random.pickIndex(seed, this.challenges.length);
        const challenge = this.challenges[index];
        return {
            challenge,
            meta: {
                ...meta,
                rng: rngMeta
            }
        };
    }
    loadChallenges() {
        const candidates = [
            _path.resolve(__dirname, 'nawak-defis.txt'),
            _path.resolve(process.cwd(), 'src', 'game', 'games', 'vents-dansants', 'nawak', 'data', 'nawak-defis.txt')
        ];
        for (const candidate of candidates){
            if (!_fs.existsSync(candidate)) continue;
            try {
                const content = _fs.readFileSync(candidate, 'utf-8');
                return this.parseContent(content);
            } catch (error) {
                this.logger.error(`Impossible de lire ${candidate} :`, error?.message ?? error);
            }
        }
        this.logger.error('Impossible de charger les défis Nawak : aucun fichier data/nawak-defis.txt accessible.');
        return [];
    }
    parseContent(content) {
        const lines = content.split(/\r?\n/);
        const challenges = [];
        let idx = 0;
        while(idx < lines.length){
            const rawLine = lines[idx].trim();
            if (!rawLine) {
                idx += 1;
                continue;
            }
            const headerMatch = rawLine.match(/^(\d+)\.$/);
            if (!headerMatch) {
                idx += 1;
                continue;
            }
            const id = headerMatch[1];
            idx += 1;
            const promptLines = [];
            while(idx < lines.length){
                const line = lines[idx].trim();
                if (!line) {
                    idx += 1;
                    continue;
                }
                if (/^[123]\.$/.test(line)) {
                    break;
                }
                if (/^\d+\.$/.test(line)) {
                    break;
                }
                promptLines.push(line);
                idx += 1;
            }
            const prompt = promptLines.join(' ').trim();
            const answers = [];
            while(answers.length < 3 && idx < lines.length){
                const marker = lines[idx].trim();
                if (!marker) {
                    idx += 1;
                    continue;
                }
                const answerMatch = marker.match(/^([123])\.$/);
                if (!answerMatch) {
                    idx += 1;
                    continue;
                }
                idx += 1;
                const answerParts = [];
                while(idx < lines.length){
                    const candidate = lines[idx].trim();
                    if (!candidate) {
                        idx += 1;
                        continue;
                    }
                    if (/^[123]\.$/.test(candidate)) {
                        break;
                    }
                    if (/^\d+\.$/.test(candidate)) {
                        break;
                    }
                    answerParts.push(candidate);
                    idx += 1;
                }
                if (answerParts.length) {
                    answers.push(answerParts.join(' '));
                }
            }
            if (prompt && answers.length >= 3) {
                challenges.push({
                    id,
                    prompt,
                    answers: [
                        answers[0],
                        answers[1],
                        answers[2]
                    ]
                });
            }
        }
        return challenges;
    }
    constructor(random){
        this.random = random;
        this.logger = new _common.Logger(NawakChallengeService.name);
        this.challenges = this.loadChallenges();
        if (!this.challenges.length) {
            this.logger.warn('Aucun défi Nawak chargé. Ajoutez des données dans data/nawak-defis.txt.');
        }
    }
};
NawakChallengeService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService
    ])
], NawakChallengeService);
