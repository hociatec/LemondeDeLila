"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoteService = void 0;
const common_1 = require("@nestjs/common");
let VoteService = class VoteService {
    resolveVotes(votes, tiePolicy = 'no-kill') {
        const tally = new Map();
        Object.values(votes || {}).forEach((target) => {
            if (target == null || target < 0)
                return;
            tally.set(target, (tally.get(target) ?? 0) + 1);
        });
        const tallyObj = {};
        tally.forEach((v, k) => (tallyObj[k] = v));
        if (tally.size === 0) {
            return { winnerId: null, tie: false, tally: tallyObj };
        }
        const sorted = Array.from(tally.entries()).sort((a, b) => b[1] - a[1]);
        const [topId, topCount] = sorted[0];
        const tie = sorted.length > 1 && sorted[1][1] === topCount;
        if (!tie) {
            return { winnerId: topId, tie: false, tally: tallyObj };
        }
        if (tiePolicy === 'random') {
            const tied = sorted
                .filter(([, count]) => count === topCount)
                .map(([id]) => id);
            const pick = tied[Math.floor(Math.random() * tied.length)] ?? null;
            return { winnerId: pick, tie: true, tally: tallyObj };
        }
        if (tiePolicy === 'all') {
            return { winnerId: null, tie: true, tally: tallyObj };
        }
        return { winnerId: null, tie: true, tally: tallyObj };
    }
};
exports.VoteService = VoteService;
exports.VoteService = VoteService = __decorate([
    (0, common_1.Injectable)()
], VoteService);
//# sourceMappingURL=vote.service.js.map