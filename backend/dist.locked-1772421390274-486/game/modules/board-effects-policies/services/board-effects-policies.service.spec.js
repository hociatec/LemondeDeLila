"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _boardeffectspoliciesservice = require("./board-effects-policies.service");
describe('BoardEffectsPoliciesService', ()=>{
    let service;
    beforeEach(()=>{
        service = new _boardeffectspoliciesservice.BoardEffectsPoliciesService();
    });
    it('formats tile labels consistently', ()=>{
        expect(service.formatTileLabel(3, '')).toBe('Case 4');
        expect(service.formatTileLabel(3, 'Case 4 - Case neutre')).toBe('Case 4 - Case neutre');
        expect(service.formatTileLabel(3, 'Couloir des portraits')).toBe('Case 4 - Couloir des portraits');
    });
    it('builds placement log', ()=>{
        const line = service.createPlacementLog({
            playerLabel: 'Lilas',
            pawnLabel: 'sa citrouille rigolote',
            position: 1,
            tileLabel: 'Case 2 - Hall du manoir'
        });
        expect(line).toBe('Lilas place sa citrouille rigolote en case 2 (Case 2 - Hall du manoir).');
    });
    it('creates draw pending for configured tile type', ()=>{
        const landing = service.resolveLanding({
            position: 9,
            playerId: 7,
            tile: {
                type: 'symbol',
                description: 'Un vieux parquet craque.'
            },
            drawPolicies: {
                symbol: {
                    log: 'Piochez une carte.',
                    pendingLabel: 'Piocher une carte (Espace).',
                    data: {
                        deck: 'events'
                    }
                }
            }
        });
        expect(landing.isFinish).toBe(false);
        expect(landing.logs).toEqual([
            'Un vieux parquet craque.',
            'Piochez une carte.'
        ]);
        expect(landing.pending).toEqual({
            type: 'draw',
            playerId: 7,
            blocking: true,
            label: 'Piocher une carte (Espace).',
            data: {
                deck: 'events'
            }
        });
    });
    it('marks finish without pending', ()=>{
        const landing = service.resolveLanding({
            position: 49,
            playerId: 3,
            tile: {
                type: 'finish',
                description: 'Arrivee.'
            }
        });
        expect(landing.isFinish).toBe(true);
        expect(landing.pending).toBeNull();
        expect(landing.logs).toEqual([
            'Arrivee.'
        ]);
    });
});
