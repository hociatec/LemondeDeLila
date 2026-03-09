"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _config = require("@nestjs/config");
const _crypto = require("crypto");
const _jwkscontroller = require("./jwks.controller");
describe('JwksController', ()=>{
    it('returns a JWKS when RS256 is configured', ()=>{
        const { publicKey } = (0, _crypto.generateKeyPairSync)('rsa', {
            modulusLength: 2048
        });
        const publicKeyPem = publicKey.export({
            type: 'spki',
            format: 'pem'
        });
        const config = new _config.ConfigService({
            JWT_ALGORITHM: 'RS256',
            JWT_PUBLIC_KEY_PEM: publicKeyPem,
            JWT_ISSUER: 'le-monde-de-lila'
        });
        const controller = new _jwkscontroller.JwksController(config);
        const res = controller.jwks();
        expect(res?.keys?.length).toBe(1);
        expect(res.keys[0]).toMatchObject({
            kty: 'RSA',
            use: 'sig',
            alg: 'RS256'
        });
        expect(typeof res.keys[0].n).toBe('string');
        expect(typeof res.keys[0].e).toBe('string');
        expect(typeof res.keys[0].kid).toBe('string');
    });
});
