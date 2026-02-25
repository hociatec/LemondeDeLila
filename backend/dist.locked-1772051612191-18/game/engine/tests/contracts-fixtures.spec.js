"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _fs = /*#__PURE__*/ _interop_require_wildcard(require("fs"));
const _path = /*#__PURE__*/ _interop_require_wildcard(require("path"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
function isJsonObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function repoRoot() {
    return _path.resolve(__dirname, '../../../../..');
}
function tryReadJson(relativeToRepoRoot) {
    const abs = _path.resolve(repoRoot(), relativeToRepoRoot);
    if (!_fs.existsSync(abs)) {
        return null;
    }
    const raw = JSON.parse(_fs.readFileSync(abs, 'utf-8'));
    if (!isJsonObject(raw)) {
        return null;
    }
    return raw;
}
function expectString(value) {
    expect(typeof value).toBe('string');
}
function expectNumber(value) {
    expect(typeof value).toBe('number');
}
function expectBoolean(value) {
    expect(typeof value).toBe('boolean');
}
function expectArray(value) {
    expect(Array.isArray(value)).toBe(true);
}
describe('Contract fixtures', ()=>{
    it('parses game.state fixtures and contains expected keys', ()=>{
        const setup = tryReadJson('contracts/fixtures/game.state.setup.json');
        const started = tryReadJson('contracts/fixtures/game.state.started.json');
        if (!setup || !started) {
            return;
        }
        for (const state of [
            setup,
            started
        ]){
            expectString(state.status);
            expectString(state.phase);
            expectNumber(state.round);
            expectNumber(state.turnIndex);
            expectArray(state.log);
            expectBoolean(state.botThinking);
            expectArray(state.actions);
            expect(state.pending === null || typeof state.pending === 'object').toBe(true);
            expect(state.turn && typeof state.turn === 'object').toBe(true);
            expect(state.turn.direction === 1 || state.turn.direction === -1).toBe(true);
            const turn = state.turn;
            expect(isJsonObject(turn)).toBe(true);
            if (isJsonObject(turn)) {
                expect(turn.currentPlayerId === null || typeof turn.currentPlayerId === 'number').toBe(true);
                expectString(turn.label);
            }
            if (state.players != null) {
                expectArray(state.players);
            }
            const extras = state.extras;
            expect(isJsonObject(extras)).toBe(true);
            if (isJsonObject(extras)) {
                expectArray(extras.playerViews);
                expectArray(extras.players);
                expectArray(extras.shortcuts);
            }
        }
        const setupStatus = typeof setup.status === 'string' ? setup.status.toLowerCase() : '';
        const startedStatus = typeof started.status === 'string' ? started.status.toLowerCase() : '';
        expect(setupStatus).toBe('setup');
        expect(startedStatus).toBe('started');
    });
    it('parses room.payload fixture and contains expected keys', ()=>{
        const payload = tryReadJson('contracts/fixtures/room.payload.json');
        if (!payload) {
            return;
        }
        const room = payload['room'];
        expect(isJsonObject(room)).toBe(true);
        if (!isJsonObject(room)) {
            return;
        }
        expectNumber(room.id);
        expectString(room.gameType);
        expectArray(room.players);
    });
});
