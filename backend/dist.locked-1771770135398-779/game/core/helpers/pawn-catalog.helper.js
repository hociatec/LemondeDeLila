"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadCanonicalPawns = loadCanonicalPawns;
function normalizeText(value) {
    if (typeof value === 'string')
        return value.trim();
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value).trim();
    }
    return '';
}
function loadCanonicalPawns(rawPawns) {
    const source = Array.isArray(rawPawns) ? rawPawns : [];
    return source
        .map((pawn) => {
        const entry = pawn && typeof pawn === 'object'
            ? pawn
            : null;
        const id = normalizeText(entry?.id);
        const name = normalizeText(entry?.name);
        const description = normalizeText(entry?.description);
        if (!id || !name)
            return null;
        return { id, name, description };
    })
        .filter(Boolean);
}
//# sourceMappingURL=pawn-catalog.helper.js.map