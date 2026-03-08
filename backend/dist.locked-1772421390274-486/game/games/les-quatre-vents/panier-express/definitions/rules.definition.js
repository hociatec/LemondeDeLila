"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "PANIER_EXPRESS_PHASES", {
    enumerable: true,
    get: function() {
        return PANIER_EXPRESS_PHASES;
    }
});
const _gamedefinition = require("./game.definition");
const PANIER_EXPRESS_PHASES = [
    {
        id: _gamedefinition.PANIER_EXPRESS_GAME.phaseOrder[0].id
    },
    {
        id: _gamedefinition.PANIER_EXPRESS_GAME.phaseOrder[1].id,
        onEnter: (s)=>s
    }
];
