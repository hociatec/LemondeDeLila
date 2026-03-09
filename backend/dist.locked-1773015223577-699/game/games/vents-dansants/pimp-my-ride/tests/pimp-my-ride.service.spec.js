"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _pimpmyrideservice = require("../pimp-my-ride.service");
describe('PimpMyRideService', ()=>{
    it('devrait être défini', ()=>{
        const registry = {
            register: jest.fn()
        };
        const service = new _pimpmyrideservice.PimpMyRideService(registry, {}, {}, {}, {});
        expect(service).toBeDefined();
    });
});
