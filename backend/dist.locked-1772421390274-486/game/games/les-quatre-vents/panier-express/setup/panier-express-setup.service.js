"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PanierExpressSetupService", {
    enumerable: true,
    get: function() {
        return PanierExpressSetupService;
    }
});
const _common = require("@nestjs/common");
const _deckmanagerservice = require("../../../../modules/cards/services/deck-manager.service");
const _deckpoolservice = require("../../../../modules/cards/services/deck-pool.service");
const _seededshuffle = require("../../../../../common/utils/seeded-shuffle");
const _gamecontentloaderservice = require("../../../../engine/services/game-content-loader.service");
const _contentloaderhelper = require("../../../../setup/content-loader.helper");
const _pawncataloghelper = require("../../../../core/helpers/pawn-catalog.helper");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let PanierExpressSetupService = class PanierExpressSetupService {
    loadBoard() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'panier-express',
            baseDir: __dirname,
            filename: 'board.json',
            arrayField: 'tiles',
            minItems: 1
        });
    }
    loadCourses() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'panier-express',
            baseDir: __dirname,
            filename: 'courses.json',
            arrayField: 'items',
            minItems: 1
        });
    }
    loadStands() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'panier-express',
            baseDir: __dirname,
            filename: 'stands.json',
            arrayField: 'stands',
            minItems: 1
        });
    }
    loadEvents() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'panier-express',
            baseDir: __dirname,
            filename: 'events.json',
            arrayField: 'events',
            minItems: 1
        });
    }
    loadExchanges() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'panier-express',
            baseDir: __dirname,
            filename: 'exchanges.json',
            arrayField: 'exchanges',
            minItems: 1
        });
    }
    loadQuizzes() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'panier-express',
            baseDir: __dirname,
            filename: 'quizzes.json',
            arrayField: 'quizzes'
        });
    }
    loadPawns() {
        return (0, _contentloaderhelper.loadV1Content)(this.contentLoader, {
            gameType: 'panier-express',
            baseDir: __dirname,
            filename: 'pawns.json',
            arrayField: 'pawns',
            minItems: 1
        });
    }
    courseItems() {
        return this.loadCourses().items.map((v)=>String(v)).map((v)=>v.trim()).filter((v)=>v.length > 0);
    }
    eventCards() {
        return this.loadEvents().events.map((v)=>String(v)).map((v)=>v.trim()).filter((v)=>v.length > 0);
    }
    exchangeCards() {
        return this.loadExchanges().exchanges.map((v)=>String(v)).map((v)=>v.trim()).filter((v)=>v.length > 0);
    }
    standCourseMap() {
        const out = {};
        this.loadStands().stands.forEach((s)=>{
            if (!s || typeof s.id !== 'string') return;
            const id = s.id.trim();
            if (!id) return;
            const items = Array.isArray(s.items) ? s.items.map((v)=>String(v)).map((v)=>v.trim()).filter((v)=>v.length > 0).slice(0, PanierExpressSetupService.MAX_STAND_ITEMS) : [];
            out[id] = items;
        });
        return out;
    }
    buildTiles() {
        return this.loadBoard().tiles;
    }
    extractSeed(baseState) {
        const seed = baseState?.metadata?.rng?.seed;
        return typeof seed === 'number' && Number.isFinite(seed) ? seed : null;
    }
    buildDeckPool(baseState) {
        const seed = this.extractSeed(baseState);
        const shuffle = (items, salt)=>{
            if (seed != null) return (0, _seededshuffle.seededShuffle)(items, seed, salt);
            return this.deckPool.shuffle([
                ...items
            ]);
        };
        let pool = {};
        pool = this.setDeck(pool, 'courses', shuffle(this.courseItems(), 'panier-express:courses'));
        pool = this.setDeck(pool, 'events', shuffle(this.loadEvents().events.map((v)=>String(v)).filter((v)=>v.length > 0), 'panier-express:events'));
        pool = this.setDeck(pool, 'exchanges', shuffle(this.loadExchanges().exchanges.map((v)=>String(v)).filter((v)=>v.length > 0), 'panier-express:exchanges'));
        pool = this.setDeck(pool, 'quizzes', this.buildQuizDeck(seed));
        const standMap = this.standCourseMap();
        const standIds = new Set();
        this.buildTiles().filter((t)=>t.type === 'stand').forEach((t)=>standIds.add(t.standId));
        standIds.add('bonus');
        standIds.forEach((standId)=>{
            const items = standMap[standId] ?? this.courseItems();
            const deck = this.buildReplenishableDeck(items);
            pool = this.setDeck(pool, `courses-${standId}`, shuffle(deck, `panier-express:courses-${standId}`));
        });
        return pool;
    }
    buildQuizDeck(seed) {
        const quizzes = this.loadQuizzes().quizzes ?? [];
        const normalized = quizzes.map((q)=>({
                id: typeof q?.id === 'string' ? String(q.id) : undefined,
                question: String(q?.question ?? '').trim(),
                answer: String(q?.answer ?? '').trim(),
                choices: Array.isArray(q?.choices) ? q.choices.map((v)=>String(v)).map((v)=>v.trim()).filter((v)=>v.length > 0) : []
            })).filter((q)=>q.question.length > 0 && q.answer.length > 0);
        if (seed != null) {
            return (0, _seededshuffle.seededShuffle)(normalized, seed, 'panier-express:quizzes');
        }
        return this.decks.shuffle(normalized);
    }
    pawns() {
        return this.pawnChoices().map((p)=>p.name);
    }
    pawnChoices() {
        return (0, _pawncataloghelper.loadCanonicalPawns)(this.loadPawns().pawns).map((pawn)=>({
                id: pawn.id,
                name: pawn.name,
                description: pawn.description
            })).filter((p)=>p.id.length > 0 && p.name.length > 0);
    }
    /**
   * Les stands doivent pouvoir être revisités plusieurs fois au cours d'une même partie.
   * On duplique volontairement les cartes disponibles pour simuler le réassort permanent.
   */ buildReplenishableDeck(items) {
        const source = items && items.length ? [
            ...items
        ] : [
            ...this.courseItems()
        ];
        return [
            ...source,
            ...source
        ];
    }
    setDeck(pool, key, deck) {
        const updated = this.deckPool.set(pool, key, deck);
        return updated;
    }
    constructor(decks, deckPool, contentLoader){
        this.decks = decks;
        this.deckPool = deckPool;
        this.contentLoader = contentLoader;
    }
};
PanierExpressSetupService.MAX_STAND_ITEMS = 3;
PanierExpressSetupService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _deckmanagerservice.DeckManagerService === "undefined" ? Object : _deckmanagerservice.DeckManagerService,
        typeof _deckpoolservice.DeckPoolService === "undefined" ? Object : _deckpoolservice.DeckPoolService,
        typeof _gamecontentloaderservice.GameContentLoaderService === "undefined" ? Object : _gamecontentloaderservice.GameContentLoaderService
    ])
], PanierExpressSetupService);
