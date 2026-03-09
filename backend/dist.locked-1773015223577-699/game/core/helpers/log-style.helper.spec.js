"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _logstylehelper = require("./log-style.helper");
describe('log-style.helper', ()=>{
    it('normalizes spaces and line breaks', ()=>{
        expect((0, _logstylehelper.normalizeGameLogMessage)('  Lila\n\tjoue   une carte  .  ')).toBe('Lila joue une carte.');
    });
    it('repairs mojibake in log messages', ()=>{
        expect((0, _logstylehelper.normalizeGameLogMessage)('Victoire de Lila : défi gagné.')).toBe('Victoire de Lila: défi gagné.');
    });
    it('removes duplicated final dot in composed labels', ()=>{
        expect((0, _logstylehelper.normalizeGameLogMessage)('Lilas choisit le pion : Le Lion: Majestueux et fier..')).toBe('Lilas choisit le pion: Le Lion: Majestueux et fier.');
    });
    it('normalizes common french accent typos in logs', ()=>{
        expect((0, _logstylehelper.normalizeGameLogMessage)('Debut de partie : Lila commence.')).toBe('Début de partie: Lila commence.');
        expect((0, _logstylehelper.normalizeGameLogMessage)('Lila lance le de : "4".')).toBe('Lila lance le dé: "4".');
        expect((0, _logstylehelper.normalizeGameLogMessage)('Lancez le de : "5".')).toBe('Lancez le dé: "5".');
    });
    it('returns empty string for empty input', ()=>{
        expect((0, _logstylehelper.normalizeGameLogMessage)('   \n\t')).toBe('');
    });
});
