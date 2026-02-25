"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildPawnSelectionPending = buildPawnSelectionPending;
const pawns_utils_1 = require("./pawns.utils");
function buildPawnSelectionPending(players, meta) {
    const cleaned = (players ?? []).filter((p) => Boolean(p && typeof p.id === 'number'));
    if (!cleaned.length)
        return null;
    const assigned = new Set(cleaned
        .map((p) => (0, pawns_utils_1.resolvePawnId)(p.pawn))
        .filter((id) => Boolean(id)));
    const candidates = availablePawns(meta, assigned);
    if (!candidates.length)
        return null;
    const nextPlayer = cleaned.find((p) => !(0, pawns_utils_1.resolvePawnId)(p.pawn));
    if (!nextPlayer)
        return null;
    return {
        type: 'choose_pawn',
        playerId: nextPlayer.id,
        blocking: true,
        choices: candidates.map((pawn) => (0, pawns_utils_1.formatPawnChoiceLabel)(pawn)),
        data: {
            kind: 'choose_pawn',
            pawns: candidates,
        },
    };
}
function availablePawns(meta, assigned) {
    const list = Array.isArray(meta?.pawns) ? meta.pawns : [];
    return list.filter((pawn) => {
        const id = (0, pawns_utils_1.resolvePawnId)(pawn?.id);
        return id != null && !assigned.has(id);
    });
}
//# sourceMappingURL=pawn-selection.js.map