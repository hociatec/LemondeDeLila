"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DeckManagerService = void 0;
const common_1 = require("@nestjs/common");
let DeckManagerService = class DeckManagerService {
    shuffle(arr) {
        const copy = [...arr];
        for (let i = copy.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [copy[i], copy[j]] = [copy[j], copy[i]];
        }
        return copy;
    }
    draw(deck, discards) {
        let deckToUse = [...deck];
        let discardsToUse = [...discards];
        if (deckToUse.length === 0 && discardsToUse.length > 0) {
            deckToUse = this.shuffle(discardsToUse);
            discardsToUse = [];
        }
        if (deckToUse.length === 0) {
            return null;
        }
        const [card, ...rest] = deckToUse;
        return { card, deck: rest, discards: discardsToUse };
    }
};
exports.DeckManagerService = DeckManagerService;
exports.DeckManagerService = DeckManagerService = __decorate([
    (0, common_1.Injectable)()
], DeckManagerService);
//# sourceMappingURL=deck-manager.service.js.map