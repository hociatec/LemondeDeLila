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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NawakChallengeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NawakChallengeService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const random_service_1 = require("../../../../modules/random/services/random.service");
let NawakChallengeService = NawakChallengeService_1 = class NawakChallengeService {
    random;
    logger = new common_1.Logger(NawakChallengeService_1.name);
    challenges;
    constructor(random) {
        this.random = random;
        this.challenges = this.loadChallenges();
        if (!this.challenges.length) {
            this.logger.warn('Aucun défi Nawak chargé. Ajoutez des données dans data/nawak-defis.txt.');
        }
    }
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
                rng: rngMeta,
            },
        };
    }
    loadChallenges() {
        const candidates = [
            path.resolve(__dirname, 'nawak-defis.txt'),
            path.resolve(process.cwd(), 'src', 'game', 'games', 'vents-dansants', 'nawak', 'data', 'nawak-defis.txt'),
        ];
        for (const candidate of candidates) {
            if (!fs.existsSync(candidate))
                continue;
            try {
                const content = fs.readFileSync(candidate, 'utf-8');
                return this.parseContent(content);
            }
            catch (error) {
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
        while (idx < lines.length) {
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
            while (idx < lines.length) {
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
            while (answers.length < 3 && idx < lines.length) {
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
                while (idx < lines.length) {
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
                    answers: [answers[0], answers[1], answers[2]],
                });
            }
        }
        return challenges;
    }
};
exports.NawakChallengeService = NawakChallengeService;
exports.NawakChallengeService = NawakChallengeService = NawakChallengeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [random_service_1.RandomService])
], NawakChallengeService);
//# sourceMappingURL=nawak-challenge.service.js.map