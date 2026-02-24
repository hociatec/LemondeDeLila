"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LamaShortcutsService = void 0;
const common_1 = require("@nestjs/common");
const shortcut_utils_1 = require("../../../../engine/shortcuts/shortcut-utils");
const lama_shared_service_1 = require("../shared/lama-shared.service");
let LamaShortcutsService = class LamaShortcutsService {
    constructor(_shared) { }
    getShortcuts(ctx) {
        if (!ctx?.started)
            return [];
        const meta = ctx?.metadata ?? {};
        const currentPlayerId = ctx?.currentPlayerId ?? null;
        const droppedOutByPlayerId = meta?.droppedOutByPlayerId &&
            typeof meta.droppedOutByPlayerId === 'object'
            ? meta.droppedOutByPlayerId
            : {};
        const drawLocked = Object.values(droppedOutByPlayerId).some((isOut) => Boolean(isOut));
        const currentPlayerDropped = currentPlayerId != null &&
            Boolean(droppedOutByPlayerId[String(currentPlayerId)]);
        const deckCount = Array.isArray(meta?.deck) ? meta.deck.length : 0;
        const tracker = meta?.turnTracker ?? null;
        const trackerPlayerId = typeof tracker?.playerId === 'number'
            ? tracker.playerId
            : Number.isFinite(Number(tracker?.playerId))
                ? Number(tracker.playerId)
                : null;
        const trackerDrawn = tracker?.drawn === true ||
            tracker?.drawn === 1 ||
            String(tracker?.drawn ?? '').toLowerCase() === 'true';
        const isSameTurn = trackerPlayerId === currentPlayerId;
        const canDraw = isSameTurn &&
            !currentPlayerDropped &&
            !drawLocked &&
            deckCount > 0 &&
            !trackerDrawn;
        return [
            ...(canDraw ? [(0, shortcut_utils_1.actionShortcut)('SPACE', 'draw')] : []),
            (0, shortcut_utils_1.interfaceShortcut)('C', 'discard'),
            (0, shortcut_utils_1.interfaceShortcut)('E', 'hands'),
            (0, shortcut_utils_1.interfaceShortcut)('S', 'score'),
            (0, shortcut_utils_1.actionShortcut)('P', 'lama_quit'),
            (0, shortcut_utils_1.actionShortcut)('Q', 'lama_quit'),
        ];
    }
};
exports.LamaShortcutsService = LamaShortcutsService;
exports.LamaShortcutsService = LamaShortcutsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [lama_shared_service_1.LamaSharedService])
], LamaShortcutsService);
//# sourceMappingURL=lama-shortcuts.service.js.map