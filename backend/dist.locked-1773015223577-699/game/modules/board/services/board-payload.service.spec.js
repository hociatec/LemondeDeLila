"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _boardpayloadservice = require("./board-payload.service");
describe('BoardPayloadService', ()=>{
    it('buildPositionPanelMessage includes other players positions when available', ()=>{
        const svc = new _boardpayloadservice.BoardPayloadService();
        const msg = svc.buildPositionPanelMessage({
            tilesRaw: [
                {},
                {},
                {}
            ],
            positionsRaw: {
                3: 0,
                5: 2
            },
            playerId: 3
        });
        expect(msg).toContain('Vous :');
        expect(msg).toContain('Joueur 5 :');
        expect(msg).toContain('case 1/3');
        expect(msg).toContain('case 3/3');
    });
});
