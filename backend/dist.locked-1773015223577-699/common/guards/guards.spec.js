"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _config = require("@nestjs/config");
const _jsonwebtoken = /*#__PURE__*/ _interop_require_default(require("jsonwebtoken"));
const _crypto = require("crypto");
const _httpjwtguard = require("./http-jwt.guard");
const _wsjwtguard = require("./ws-jwt.guard");
function _interop_require_default(obj) {
    return obj && obj.__esModule ? obj : {
        default: obj
    };
}
const jwtSign = _jsonwebtoken.default.sign;
function createHttpContext(request) {
    return {
        switchToHttp: ()=>({
                getRequest: ()=>request
            })
    };
}
function createWsContext(client) {
    return {
        switchToWs: ()=>({
                getClient: ()=>client
            })
    };
}
describe('Auth guards', ()=>{
    const secret = 'unit-test-secret-unit-test-secret-unit-test-secret';
    const issuer = 'le-monde-de-lila';
    const config = new _config.ConfigService({
        JWT_SECRET: secret,
        JWT_ISSUER: issuer
    });
    it('HttpJwtGuard attaches payload to request', ()=>{
        const guard = new _httpjwtguard.HttpJwtGuard(config);
        const token = jwtSign({
            username: 'lila'
        }, secret, {
            algorithm: 'HS256',
            issuer,
            subject: '1',
            expiresIn: '1h'
        });
        const request = {
            headers: {
                authorization: `Bearer ${token}`
            }
        };
        const context = createHttpContext(request);
        expect(guard.canActivate(context)).toBe(true);
        expect(request.user).toMatchObject({
            username: 'lila'
        });
    });
    it('WsJwtGuard accepts token via query string', ()=>{
        const guard = new _wsjwtguard.WsJwtGuard(config);
        const token = jwtSign({
            id: 42,
            username: 'x'
        }, secret, {
            algorithm: 'HS256',
            issuer,
            subject: '42',
            expiresIn: '1h'
        });
        const client = {
            handshakeHeaders: {},
            handshake: {
                headers: {},
                auth: {}
            },
            req: {
                headers: {}
            },
            url: `ws://localhost?token=${token}`
        };
        const context = createWsContext(client);
        expect(guard.canActivate(context)).toBe(true);
        expect(client.user).toMatchObject({
            id: 42
        });
    });
    it('HttpJwtGuard supports RS256 with public key', ()=>{
        const { publicKey, privateKey } = (0, _crypto.generateKeyPairSync)('rsa', {
            modulusLength: 2048
        });
        const publicKeyPem = publicKey.export({
            type: 'spki',
            format: 'pem'
        });
        const privateKeyPem = privateKey.export({
            type: 'pkcs8',
            format: 'pem'
        });
        const rsaConfig = new _config.ConfigService({
            JWT_PUBLIC_KEY_PEM: publicKeyPem,
            JWT_PRIVATE_KEY_PEM: privateKeyPem,
            JWT_ISSUER: issuer
        });
        const guard = new _httpjwtguard.HttpJwtGuard(rsaConfig);
        const token = jwtSign({
            username: 'lila'
        }, privateKeyPem, {
            algorithm: 'RS256',
            issuer,
            subject: '1',
            expiresIn: '1h'
        });
        const request = {
            headers: {
                authorization: `Bearer ${token}`
            }
        };
        const context = createHttpContext(request);
        expect(guard.canActivate(context)).toBe(true);
        expect(request.user).toMatchObject({
            username: 'lila'
        });
    });
});
