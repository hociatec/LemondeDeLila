"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _lesmainsdelaterreservice = require("../les-mains-de-la-terre.service");
describe('LesMainsDeLaTerreService', ()=>{
    it('doit être défini', ()=>{
        const registry = {
            register: jest.fn()
        };
        const service = new _lesmainsdelaterreservice.LesMainsDeLaTerreService(registry, {}, {}, {}, {});
        expect(service).toBeDefined();
    });
});
