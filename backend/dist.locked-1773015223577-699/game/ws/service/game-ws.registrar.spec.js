"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _wsrouteregistryservice = require("../../../common/ws/ws-route-registry.service");
const _gamewsregistrar = require("./game-ws.registrar");
describe('GameWsRegistrar', ()=>{
    it('registers rules + backward-compatible aliases', ()=>{
        const registry = new _wsrouteregistryservice.WsRouteRegistry();
        const handler = {
            rules: jest.fn(async ()=>null),
            modules: jest.fn(async ()=>null)
        };
        const registrar = new _gamewsregistrar.GameWsRegistrar(registry, handler);
        registrar.onModuleInit();
        expect(registry.has('game.rules')).toBe(true);
        expect(registry.has('game.rules.get')).toBe(true);
        expect(registry.has('game.rulebook')).toBe(true);
        expect(registry.has('game.rulebook.get')).toBe(true);
        expect(registry.has('rules')).toBe(true);
        expect(registry.has('game.modules')).toBe(true);
    });
});
