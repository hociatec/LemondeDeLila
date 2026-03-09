"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _lagrandeminedebarbakservice = require("../la-grande-mine-de-barbak.service");
describe('LaGrandeMineDeBarbakService', ()=>{
    it('should be defined', ()=>{
        const registry = {
            register: jest.fn()
        };
        const service = new _lagrandeminedebarbakservice.LaGrandeMineDeBarbakService(registry, {}, {}, {}, {});
        expect(service).toBeDefined();
    });
});
