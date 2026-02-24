"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.turnAnnouncement = turnAnnouncement;
exports.pawnPlacement = pawnPlacement;
exports.diceRoll = diceRoll;
exports.victoryAnnouncement = victoryAnnouncement;
function turnAnnouncement(playerLabel) {
    const name = String(playerLabel ?? '').trim() || 'Joueur';
    return `C'est au tour de ${name}.`;
}
function pawnPlacement(params) {
    return `${params.playerLabel} place ${params.pawnLabel} en case ${params.position + 1} (${params.tileLabel}).`;
}
function diceRoll(params) {
    const sides = Number.isFinite(params.sides) ? Number(params.sides) : 6;
    return `${params.playerLabel} lance un dé (${params.value}/${sides}).`;
}
function victoryAnnouncement(playerLabel) {
    const name = String(playerLabel ?? '').trim() || 'Joueur';
    return `Victoire de ${name}.`;
}
//# sourceMappingURL=game-log-text.helper.js.map