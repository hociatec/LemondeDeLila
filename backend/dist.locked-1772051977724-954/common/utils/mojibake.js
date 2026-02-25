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
    get fixMojibakeDeep () {
        return fixMojibakeDeep;
    },
    get fixMojibakeString () {
        return fixMojibakeString;
    },
    get readJsonFileWithFallback () {
        return readJsonFileWithFallback;
    },
    get readTextFileWithFallback () {
        return readTextFileWithFallback;
    }
});
const _nodefs = /*#__PURE__*/ _interop_require_wildcard(require("node:fs"));
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
function readTextFileWithFallback(filePath) {
    const utf8 = _nodefs.readFileSync(filePath, {
        encoding: 'utf8'
    }).replace(/^\uFEFF/, '');
    const replacementCount = (utf8.match(/\uFFFD/g) ?? []).length;
    if (replacementCount <= 2) return utf8;
    return _nodefs.readFileSync(filePath, {
        encoding: 'latin1'
    }).replace(/^\uFEFF/, '');
}
function applyTargetedMojibakeReplacements(value) {
    let out = String(value ?? '');
    if (!out) return '';
    // Double-encoded marker often seen in imported text blobs.
    out = out.replace(/\u00C3ƒ\u00C2/g, '\u00C3');
    const replacements = [
        [
            /\u00C3€/g,
            'À'
        ],
        [
            /\u00C3‚/g,
            '\u00C2'
        ],
        [
            /\u00C3„/g,
            'Ä'
        ],
        [
            /\u00C3‡/g,
            'Ç'
        ],
        [
            /\u00C3ˆ/g,
            'È'
        ],
        [
            /\u00C3‰/g,
            'É'
        ],
        [
            /\u00C3Š/g,
            'Ê'
        ],
        [
            /\u00C3‹/g,
            'Ë'
        ],
        [
            /\u00C3Ž/g,
            'Î'
        ],
        [
            /\u00C3Ï/g,
            'Ï'
        ],
        [
            /\u00C3”/g,
            'Ô'
        ],
        [
            /\u00C3–/g,
            'Ö'
        ],
        [
            /\u00C3™/g,
            'Ù'
        ],
        [
            /\u00C3›/g,
            'Û'
        ],
        [
            /\u00C3œ/g,
            'Ü'
        ],
        [
            /\u00C3Ÿ/g,
            'ß'
        ],
        [
            /\u00C3 /g,
            'à'
        ],
        [
            /\u00C3¡/g,
            'á'
        ],
        [
            /\u00C3¢/g,
            'â'
        ],
        [
            /\u00C3¤/g,
            'ä'
        ],
        [
            /\u00C3§/g,
            'ç'
        ],
        [
            /\u00C3¨/g,
            'è'
        ],
        [
            /\u00C3©/g,
            'é'
        ],
        [
            /\u00C3ª/g,
            'ê'
        ],
        [
            /\u00C3«/g,
            'ë'
        ],
        [
            /\u00C3¬/g,
            'ì'
        ],
        [
            /\u00C3­/g,
            'í'
        ],
        [
            /\u00C3®/g,
            'î'
        ],
        [
            /\u00C3¯/g,
            'ï'
        ],
        [
            /\u00C3²/g,
            'ò'
        ],
        [
            /\u00C3³/g,
            'ó'
        ],
        [
            /\u00C3´/g,
            'ô'
        ],
        [
            /\u00C3¶/g,
            'ö'
        ],
        [
            /\u00C3¹/g,
            'ù'
        ],
        [
            /\u00C3º/g,
            'ú'
        ],
        [
            /\u00C3»/g,
            'û'
        ],
        [
            /\u00C3¼/g,
            'ü'
        ],
        [
            /Å“/g,
            'œ'
        ],
        [
            /Å’/g,
            'Œ'
        ],
        [
            /\u00E2\u20AC\u2122/g,
            '’'
        ],
        [
            /\u00E2\u20AC\u02DC/g,
            '‘'
        ],
        [
            /\u00E2\u20AC\u009C/g,
            '“'
        ],
        [
            /\u00E2\u20AC\u009D/g,
            '”'
        ],
        [
            /\u00E2\u20AC\u201C/g,
            '–'
        ],
        [
            /\u00E2\u20AC\u201D/g,
            '—'
        ],
        [
            /\u00E2\u20AC\u00A6/g,
            '…'
        ],
        [
            /\u00E2\u20AC\u00A2/g,
            '•'
        ],
        [
            /\u00C2 /g,
            ' '
        ],
        [
            /\u00C2(?=[,;:.!?])/g,
            ''
        ],
        [
            /Ò©/g,
            'é'
        ],
        [
            /Ò®/g,
            'î'
        ]
    ];
    for (const [pattern, replacement] of replacements){
        out = out.replace(pattern, replacement);
    }
    // Legacy mojibake seen in imported French content blobs.
    out = out.replace(/(^|[.!?]\s+)ì\s+/g, '$1À ').replace(/\bì\s+/g, 'à ');
    return out;
}
function preserveWordCase(input, replacement) {
    if (!input || !replacement) return replacement;
    if (input === input.toUpperCase()) return replacement.toUpperCase();
    if (input[0] === input[0].toUpperCase()) {
        return replacement[0].toUpperCase() + replacement.slice(1);
    }
    return replacement;
}
function normalizeFrenchDisplayTypos(value) {
    let out = String(value ?? '');
    if (!out) return '';
    out = out.replace(/\bmise\s+a\s+jour\b/gi, (raw)=>preserveWordCase(raw, 'mise à jour')).replace(/\bmises\s+a\s+jour\b/gi, (raw)=>preserveWordCase(raw, 'mises à jour')).replace(/\bpublication\/distribution\b/gi, (raw)=>preserveWordCase(raw, 'publication/distribution')).replace(/\ba\s+l(?:['’]|\s+)echeance\b/gi, (raw)=>preserveWordCase(raw, "à l'échéance"));
    const wordMap = {
        delai: 'délai',
        delais: 'délais',
        echeance: 'échéance',
        echeances: 'échéances',
        etagere: 'étagère',
        etageres: 'étagères',
        parametre: 'paramètre',
        parametres: 'paramètres',
        reponse: 'réponse',
        reponses: 'réponses',
        ecran: 'écran',
        ecrans: 'écrans'
    };
    out = out.replace(/\b[0-9A-Za-z][0-9A-Za-z'-]*\b/g, (token)=>{
        const replacement = wordMap[token.toLowerCase()];
        if (!replacement) return token;
        return preserveWordCase(token, replacement);
    });
    return out;
}
function shouldNormalizeFrenchDisplayText(key) {
    if (!key) return false;
    const normalized = key.toLowerCase();
    return normalized === 'message' || normalized === 'text' || normalized === 'title' || normalized === 'description' || normalized === 'label' || normalized === 'rules' || normalized === 'prompt' || normalized === 'instruction' || normalized === 'instructions' || normalized === 'help' || normalized === 'summary' || normalized === 'details' || normalized === 'reason' || normalized === 'subtitle';
}
function fixMojibakeString(value) {
    const score = (s)=>{
        const suspicious = (s.match(/[\u00C2\u00C3\u00E2\u0153\u0178\u0160\u0161\u017D\u017E\u2030]/g) ?? []).length;
        const replacement = (s.match(/\uFFFD/g) ?? []).length;
        return suspicious * 2 + replacement * 10;
    };
    const currentScore = score(value);
    const targetedOriginal = applyTargetedMojibakeReplacements(value);
    const targetedOriginalScore = score(targetedOriginal);
    if (currentScore === 0 && targetedOriginal === value) return value;
    const windows1252ToBytes = (input)=>{
        const map = {
            0x20ac: 0x80,
            0x201a: 0x82,
            0x0192: 0x83,
            0x201e: 0x84,
            0x2026: 0x85,
            0x2020: 0x86,
            0x2021: 0x87,
            0x02c6: 0x88,
            0x2030: 0x89,
            0x0160: 0x8a,
            0x2039: 0x8b,
            0x0152: 0x8c,
            0x017d: 0x8e,
            0x2018: 0x91,
            0x2019: 0x92,
            0x201c: 0x93,
            0x201d: 0x94,
            0x2022: 0x95,
            0x2013: 0x96,
            0x2014: 0x97,
            0x02dc: 0x98,
            0x2122: 0x99,
            0x0161: 0x9a,
            0x203a: 0x9b,
            0x0153: 0x9c,
            0x017e: 0x9e,
            0x0178: 0x9f
        };
        const bytes = [];
        for (const ch of input){
            const cp = ch.codePointAt(0) ?? 0;
            if (cp <= 0xff) {
                bytes.push(cp);
            } else if (map[cp] != null) {
                bytes.push(map[cp]);
            } else {
                bytes.push(0x3f);
            }
        }
        return Uint8Array.from(bytes);
    };
    const candidates = [
        Buffer.from(value, 'latin1').toString('utf8'),
        Buffer.from(windows1252ToBytes(value)).toString('utf8'),
        Buffer.from(targetedOriginal, 'latin1').toString('utf8'),
        Buffer.from(windows1252ToBytes(targetedOriginal)).toString('utf8')
    ].filter((c)=>typeof c === 'string' && c.length > 0);
    let best = targetedOriginalScore < currentScore ? targetedOriginal : value;
    let bestScore = Math.min(currentScore, targetedOriginalScore);
    for (const c of candidates){
        const normalized = applyTargetedMojibakeReplacements(c);
        const normalizedScore = score(normalized);
        if (normalizedScore < bestScore) {
            best = normalized;
            bestScore = normalizedScore;
            continue;
        }
        const s = score(c);
        if (s < bestScore) {
            best = c;
            bestScore = s;
        }
    }
    return best;
}
function fixMojibakeDeepInternal(value, seen, key) {
    if (typeof value === 'string') {
        const fixed = fixMojibakeString(value);
        return shouldNormalizeFrenchDisplayText(key) ? normalizeFrenchDisplayTypos(fixed) : fixed;
    }
    if (Array.isArray(value)) {
        if (seen.has(value)) {
            return seen.get(value);
        }
        const out = [];
        seen.set(value, out);
        for (const item of value){
            out.push(fixMojibakeDeepInternal(item, seen, key));
        }
        return out;
    }
    if (value && typeof value === 'object') {
        if (seen.has(value)) {
            return seen.get(value);
        }
        const obj = value;
        const out = {};
        seen.set(value, out);
        Object.keys(obj).forEach((k)=>{
            out[k] = fixMojibakeDeepInternal(obj[k], seen, k);
        });
        return out;
    }
    return value;
}
function fixMojibakeDeep(value) {
    return fixMojibakeDeepInternal(value, new WeakMap());
}
function readJsonFileWithFallback(filePath) {
    const raw = readTextFileWithFallback(filePath);
    const parsed = JSON.parse(raw);
    return fixMojibakeDeep(parsed);
}
