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
var AbsurdissimesDeckService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AbsurdissimesDeckService = void 0;
const common_1 = require("@nestjs/common");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let AbsurdissimesDeckService = AbsurdissimesDeckService_1 = class AbsurdissimesDeckService {
    logger = new common_1.Logger(AbsurdissimesDeckService_1.name);
    whiteCards;
    blackCards;
    constructor() {
        this.whiteCards = this.loadCards('white-cards.txt');
        this.blackCards = this.loadCards('black-cards.txt');
    }
    getWhiteCards() {
        return [...this.whiteCards];
    }
    getBlackCards() {
        return [...this.blackCards];
    }
    loadCards(fileName) {
        const filePath = this.resolveDataPath(fileName);
        if (!filePath) {
            this.logger.error(`Fichier de cartes introuvable : ${fileName}`);
            return [];
        }
        try {
            const raw = fs.readFileSync(filePath, 'utf-8');
            return this.parseCards(raw);
        }
        catch (error) {
            this.logger.error(`Impossible de lire ${fileName} : ${error?.message ?? 'erreur inconnue'}`);
            return [];
        }
    }
    resolveDataPath(fileName) {
        const candidates = [
            path.resolve(__dirname, 'data', fileName),
            path.resolve(process.cwd(), 'src', 'game', 'games', 'vents-dansants', 'les-absurdissimes', 'data', fileName),
            path.resolve(process.cwd(), 'dist', 'game', 'games', 'vents-dansants', 'les-absurdissimes', 'data', fileName),
        ];
        for (const candidate of candidates) {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        }
        return null;
    }
    parseCards(content) {
        const cards = [];
        const regex = /(\d+)\.\s*[\r\n]+([\s\S]*?)(?=\n\d+\.|$)/g;
        let match;
        while ((match = regex.exec(content))) {
            const raw = match[2].trim();
            if (raw) {
                const normalized = raw
                    .replace(/[\r\n]+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                cards.push(normalized);
            }
        }
        return cards;
    }
};
exports.AbsurdissimesDeckService = AbsurdissimesDeckService;
exports.AbsurdissimesDeckService = AbsurdissimesDeckService = AbsurdissimesDeckService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [])
], AbsurdissimesDeckService);
//# sourceMappingURL=absurdissimes-deck.service.js.map