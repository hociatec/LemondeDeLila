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
    get diceRoll () {
        return diceRoll;
    },
    get pawnPlacement () {
        return pawnPlacement;
    },
    get turnAnnouncement () {
        return turnAnnouncement;
    },
    get victoryAnnouncement () {
        return victoryAnnouncement;
    }
});
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
