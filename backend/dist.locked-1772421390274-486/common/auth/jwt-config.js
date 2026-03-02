"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
function _export(target, all) {
    for(var name in all)Object.defineProperty(target, name, {
        enumerable: true,
        get: Object.getOwnPropertyDescriptor(all, name).get
    });
}
_export(exports, {
    get getJwtAlgorithm () {
        return getJwtAlgorithm;
    },
    get getJwtVerifyAlgorithms () {
        return getJwtVerifyAlgorithms;
    },
    get requireJwtSigningKey () {
        return requireJwtSigningKey;
    },
    get requireJwtVerifyKey () {
        return requireJwtVerifyKey;
    }
});
const _common = require("@nestjs/common");
function normalizeAlgorithm(value) {
    const v = (value || '').trim().toUpperCase();
    if (v === 'HS256' || v === 'RS256') return v;
    return null;
}
function getJwtAlgorithm(config) {
    const explicit = normalizeAlgorithm(config.get('JWT_ALGORITHM'));
    if (explicit) return explicit;
    // Default: if RSA keys are present, prefer RS256; otherwise HS256.
    const hasRsa = !!config.get('JWT_PRIVATE_KEY_PEM') || !!config.get('JWT_PRIVATE_KEY_PATH') || !!config.get('JWT_PUBLIC_KEY_PEM') || !!config.get('JWT_PUBLIC_KEY_PATH');
    return hasRsa ? 'RS256' : 'HS256';
}
function readKeyFromPath(path) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const fs = require('fs');
        return fs.readFileSync(path, 'utf8');
    } catch  {
        throw new _common.UnauthorizedException('Configuration JWT manquante');
    }
}
function requireJwtSigningKey(config) {
    const alg = getJwtAlgorithm(config);
    if (alg === 'HS256') {
        const secret = config.get('JWT_SECRET');
        if (!secret || !secret.trim()) {
            throw new _common.UnauthorizedException('Configuration JWT manquante');
        }
        return secret;
    }
    const pem = config.get('JWT_PRIVATE_KEY_PEM') || (config.get('JWT_PRIVATE_KEY_PATH') ? readKeyFromPath(config.get('JWT_PRIVATE_KEY_PATH')) : null);
    if (!pem || !pem.trim()) {
        throw new _common.UnauthorizedException('Configuration JWT manquante');
    }
    return pem;
}
function requireJwtVerifyKey(config) {
    const alg = getJwtAlgorithm(config);
    if (alg === 'HS256') {
        const secret = config.get('JWT_SECRET');
        if (!secret || !secret.trim()) {
            throw new _common.UnauthorizedException('Configuration JWT manquante');
        }
        return secret;
    }
    const pem = config.get('JWT_PUBLIC_KEY_PEM') || (config.get('JWT_PUBLIC_KEY_PATH') ? readKeyFromPath(config.get('JWT_PUBLIC_KEY_PATH')) : null);
    if (!pem || !pem.trim()) {
        throw new _common.UnauthorizedException('Configuration JWT manquante');
    }
    return pem;
}
function getJwtVerifyAlgorithms(config) {
    const alg = getJwtAlgorithm(config);
    return [
        alg
    ];
}
