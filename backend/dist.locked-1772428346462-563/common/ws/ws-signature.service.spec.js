"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _config = require("@nestjs/config");
const _wssignatureservice = require("./ws-signature.service");
const dummySocket = (data)=>data;
const asSocket = (data)=>data;
describe('WsSignatureService', ()=>{
    it('allows connections when the shared secret is disabled', ()=>{
        const service = new _wssignatureservice.WsSignatureService(new _config.ConfigService({}));
        expect(service.isEnabled()).toBe(false);
        expect(service.validate(asSocket(dummySocket({})), [])).toBe(true);
    });
    it('rejects missing signatures when the shared secret is required', ()=>{
        const service = new _wssignatureservice.WsSignatureService(new _config.ConfigService({
            WS_SHARED_SECRET: 'super-secret'
        }));
        expect(service.isEnabled()).toBe(true);
        expect(service.validate(asSocket(dummySocket({})), [])).toBe(false);
    });
    it('accepts valid signatures from the query string', ()=>{
        const service = new _wssignatureservice.WsSignatureService(new _config.ConfigService({
            WS_SHARED_SECRET: 'needle'
        }));
        const socket = dummySocket({
            url: '/ws?signature=needle'
        });
        expect(service.validate(asSocket(socket), [])).toBe(true);
    });
    it('accepts valid signatures from headers', ()=>{
        const service = new _wssignatureservice.WsSignatureService(new _config.ConfigService({
            WS_SHARED_SECRET: 'antelope'
        }));
        const socket = dummySocket({
            handshakeHeaders: {
                'x-lila-signature': 'antelope'
            }
        });
        expect(service.validate(asSocket(socket), [])).toBe(true);
    });
    it('rejects invalid signatures', ()=>{
        const service = new _wssignatureservice.WsSignatureService(new _config.ConfigService({
            WS_SHARED_SECRET: 'antelope'
        }));
        const socket = dummySocket({
            url: '/ws?signature=wrong'
        });
        expect(service.validate(asSocket(socket), [])).toBe(false);
    });
});
