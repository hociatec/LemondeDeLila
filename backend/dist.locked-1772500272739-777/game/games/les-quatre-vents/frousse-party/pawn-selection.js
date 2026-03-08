"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "buildPawnSelectionPending", {
    enumerable: true,
    get: function() {
        return buildPawnSelectionPending;
    }
});
const _pawnsutils = require("./pawns.utils");
function buildPawnSelectionPending(players, meta) {
    const cleaned = (players ?? []).filter((p)=>Boolean(p && typeof p.id === 'number'));
    if (!cleaned.length) return null;
    const assigned = new Set(cleaned.map((p)=>(0, _pawnsutils.resolvePawnId)(p.pawn)).filter((id)=>Boolean(id)));
    const candidates = availablePawns(meta, assigned);
    if (!candidates.length) return null;
    const nextPlayer = cleaned.find((p)=>!(0, _pawnsutils.resolvePawnId)(p.pawn));
    if (!nextPlayer) return null;
    return {
        type: 'choose_pawn',
        playerId: nextPlayer.id,
        blocking: true,
        choices: candidates.map((pawn)=>(0, _pawnsutils.formatPawnChoiceLabel)(pawn)),
        data: {
            kind: 'choose_pawn',
            pawns: candidates
        }
    };
}
function availablePawns(meta, assigned) {
    const list = Array.isArray(meta?.pawns) ? meta.pawns : [];
    return list.filter((pawn)=>{
        const id = (0, _pawnsutils.resolvePawnId)(pawn?.id);
        return id != null && !assigned.has(id);
    });
}
