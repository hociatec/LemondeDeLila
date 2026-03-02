"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "LamaShortcutsService", {
    enumerable: true,
    get: function() {
        return LamaShortcutsService;
    }
});
const _common = require("@nestjs/common");
const _shortcututils = require("../../../../engine/shortcuts/shortcut-utils");
const _lamasharedservice = require("../shared/lama-shared.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let LamaShortcutsService = class LamaShortcutsService {
    getShortcuts(ctx) {
        if (!ctx?.started) return [];
        const meta = ctx?.metadata ?? {};
        const currentPlayerId = ctx?.currentPlayerId ?? null;
        const droppedOutByPlayerId = meta?.droppedOutByPlayerId && typeof meta.droppedOutByPlayerId === 'object' ? meta.droppedOutByPlayerId : {};
        const drawLocked = Object.values(droppedOutByPlayerId).some((isOut)=>Boolean(isOut));
        const currentPlayerDropped = currentPlayerId != null && Boolean(droppedOutByPlayerId[String(currentPlayerId)]);
        const deckCount = Array.isArray(meta?.deck) ? meta.deck.length : 0;
        const tracker = meta?.turnTracker ?? null;
        const trackerPlayerId = typeof tracker?.playerId === 'number' ? tracker.playerId : Number.isFinite(Number(tracker?.playerId)) ? Number(tracker.playerId) : null;
        const trackerDrawn = tracker?.drawn === true || tracker?.drawn === 1 || String(tracker?.drawn ?? '').toLowerCase() === 'true';
        const isSameTurn = trackerPlayerId === currentPlayerId;
        const canDraw = isSameTurn && !currentPlayerDropped && !drawLocked && deckCount > 0 && !trackerDrawn;
        return [
            ...canDraw ? [
                (0, _shortcututils.actionShortcut)('SPACE', 'draw')
            ] : [],
            (0, _shortcututils.interfaceShortcut)('C', 'discard'),
            (0, _shortcututils.interfaceShortcut)('E', 'hands'),
            (0, _shortcututils.interfaceShortcut)('S', 'score'),
            (0, _shortcututils.actionShortcut)('P', 'lama_quit'),
            (0, _shortcututils.actionShortcut)('Q', 'lama_quit')
        ];
    }
    constructor(_shared){}
};
LamaShortcutsService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _lamasharedservice.LamaSharedService === "undefined" ? Object : _lamasharedservice.LamaSharedService
    ])
], LamaShortcutsService);
