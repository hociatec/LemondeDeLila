"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _labandeabananeservice = require("../la-bande-a-banane.service");
describe('BandeABananeService', ()=>{
    it('devrait être défini', ()=>{
        const registry = {
            register: jest.fn()
        };
        const service = new _labandeabananeservice.BandeABananeService(registry, {}, {}, {}, {});
        expect(service).toBeDefined();
    });
});
