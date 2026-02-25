"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _catpattescards = require("../model/cat-pattes-cards");
const _rulebook = require("../rulebook/rulebook");
function buildMeta() {
    return {
        deck: [],
        discard: [],
        hands: {
            1: []
        },
        positions: {
            1: 0
        },
        points: {
            1: 0
        },
        obstacles: {
            1: null
        },
        bots: {
            1: []
        },
        turboPlayed: {
            1: 0
        },
        hasSun: {
            1: true
        },
        pawns: [
            'Maine Coon'
        ],
        pawnByPlayerId: {
            1: 'Maine Coon'
        },
        setupStarterId: 1,
        drawnPlayerId: null,
        winnerId: null
    };
}
describe('CatPattes rulebook mapping', ()=>{
    it('matches obstacle immunities to corresponding bots', ()=>{
        const meta = buildMeta();
        meta.bots[1] = [
            'chat-ninja'
        ];
        expect((0, _rulebook.playerCanReceiveObstacle)(meta, 1, 'chien')).toBe(false);
        expect((0, _rulebook.playerCanReceiveObstacle)(meta, 1, 'sol')).toBe(true);
        meta.bots[1] = [
            'reserve'
        ];
        expect((0, _rulebook.playerCanReceiveObstacle)(meta, 1, 'gamelle')).toBe(false);
        expect((0, _rulebook.playerCanReceiveObstacle)(meta, 1, 'coussin')).toBe(true);
        meta.bots[1] = [
            'patte-blindee'
        ];
        expect((0, _rulebook.playerCanReceiveObstacle)(meta, 1, 'coussin')).toBe(false);
        expect((0, _rulebook.playerCanReceiveObstacle)(meta, 1, 'pluie')).toBe(true);
        meta.bots[1] = [
            'passage-star'
        ];
        expect((0, _rulebook.playerCanReceiveObstacle)(meta, 1, 'pluie')).toBe(false);
        expect((0, _rulebook.playerCanReceiveObstacle)(meta, 1, 'sol')).toBe(false);
        expect((0, _rulebook.playerCanReceiveObstacle)(meta, 1, 'chien')).toBe(true);
    });
    it('allows movement when current obstacle is covered by the right bot', ()=>{
        const card = _catpattescards.CAT_PATTES_CARD_BY_ID['pattes-20-1'];
        const meta = buildMeta();
        meta.obstacles[1] = 'chien';
        meta.bots[1] = [
            'chat-ninja'
        ];
        expect((0, _rulebook.canPlayPattes)(meta, 1, card)).toBe(true);
        meta.obstacles[1] = 'sol';
        meta.bots[1] = [
            'passage-star'
        ];
        meta.hasSun[1] = false;
        expect((0, _rulebook.canPlayPattes)(meta, 1, card)).toBe(true);
        meta.obstacles[1] = 'sol';
        meta.bots[1] = [
            'patte-blindee'
        ];
        meta.hasSun[1] = true;
        expect((0, _rulebook.canPlayPattes)(meta, 1, card)).toBe(false);
    });
});
