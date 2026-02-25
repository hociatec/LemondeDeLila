"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VictoryService = void 0;
const common_1 = require("@nestjs/common");
let VictoryService = class VictoryService {
    checkCriteria(state, checks) {
        return checks.some((fn) => fn(state));
    }
    evaluate(state, conditions) {
        for (const condition of conditions ?? []) {
            if (!condition?.check)
                continue;
            const raw = condition.check(state);
            const normalized = typeof raw === 'boolean'
                ? { finished: raw, winnerId: null }
                : { winnerId: null, ...raw };
            if (normalized.finished) {
                return { ...normalized, conditionId: condition.id };
            }
        }
        return null;
    }
    getOverview() {
        return {
            id: 'victory',
            label: 'Conditions de victoire',
            description: 'Cadre pour définir et vérifier les conditions gagnantes ou de fin de partie.',
            capabilities: [
                {
                    id: 'criteria',
                    description: 'Définition de critères (objectifs, score, positions).',
                },
                {
                    id: 'checks',
                    description: 'Évaluation des critères à chaque tour ou événement.',
                },
                {
                    id: 'resolution',
                    description: 'Annonce du vainqueur et fin de partie.',
                },
            ],
        };
    }
};
exports.VictoryService = VictoryService;
exports.VictoryService = VictoryService = __decorate([
    (0, common_1.Injectable)()
], VictoryService);
//# sourceMappingURL=victory.service.js.map