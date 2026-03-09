"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _entreritesservice = require("../entre-rites.service");
describe('EntreRitesService', ()=>{
    it('should be defined', ()=>{
        const registry = {
            register: jest.fn()
        };
        const service = new _entreritesservice.EntreRitesService(registry, {}, {}, {}, {});
        expect(service).toBeDefined();
    });
});
