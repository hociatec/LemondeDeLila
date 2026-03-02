"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _pawncataloghelper = require("./pawn-catalog.helper");
describe('pawn-catalog.helper', ()=>{
    it('loads canonical pawns from name', ()=>{
        const pawns = (0, _pawncataloghelper.loadCanonicalPawns)([
            {
                id: 'lion',
                name: 'Le Lion',
                description: 'Majestueux'
            }
        ]);
        expect(pawns).toEqual([
            {
                id: 'lion',
                name: 'Le Lion',
                description: 'Majestueux'
            }
        ]);
    });
    it('ignores entries without canonical name', ()=>{
        const pawns = (0, _pawncataloghelper.loadCanonicalPawns)([
            {
                id: 'elephant',
                title: "L'Elephant",
                description: 'Imposant'
            }
        ]);
        expect(pawns).toEqual([]);
    });
});
