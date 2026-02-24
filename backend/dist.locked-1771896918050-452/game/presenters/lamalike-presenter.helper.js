"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildLamaLikePanels = buildLamaLikePanels;
exports.summarizeHandCounts = summarizeHandCounts;
const DEFAULT_INSTRUCTION = '(↑/↓ choisir, Entrée jouer, Espace piocher, C défausse, E mains, S score)';
function buildLamaLikePanels(params) {
    const handMessage = params.hand.length
        ? `Main : ${params.hand.join(', ')}`
        : 'Main : (vide)';
    const handsMessage = params.handsMessage ??
        (params.handCounts && Object.keys(params.handCounts).length
            ? `Mains : ${Object.entries(params.handCounts)
                .map(([playerId, count]) => `Joueur ${playerId}: ${count}`)
                .join(' • ')}`
            : 'Mains : (inconnues)');
    const discardLabel = params.discardLabel ?? '(vide)';
    const playMessage = params.playMessage ??
        `Défausse : ${discardLabel}. Main : ${params.hand.length} carte(s). ${DEFAULT_INSTRUCTION}`;
    const scoreMessage = params.scoreLines && params.scoreLines.length
        ? `Score : ${params.scoreLines.join(' • ')}`
        : 'Score : inconnus.';
    const tableMessage = params.tableMessage ?? 'Table : état de la partie.';
    return {
        hand: { title: 'Main', message: handMessage },
        hands: { title: 'Mains', message: handsMessage },
        discard: { title: 'Défausse', message: `Défausse : ${discardLabel}.` },
        play: { title: 'À jouer', message: playMessage },
        score: { title: 'Score', message: scoreMessage },
        table: { title: 'Table', message: tableMessage },
    };
}
function summarizeHandCounts(hands) {
    const summary = {};
    if (!hands || typeof hands !== 'object')
        return summary;
    Object.entries(hands).forEach(([rawId, cards]) => {
        const playerId = Number(rawId);
        if (!Number.isFinite(playerId))
            return;
        summary[playerId] = Array.isArray(cards) ? cards.length : 0;
    });
    return summary;
}
//# sourceMappingURL=lamalike-presenter.helper.js.map