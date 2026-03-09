"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "SetupFlowService", {
    enumerable: true,
    get: function() {
        return SetupFlowService;
    }
});
const _common = require("@nestjs/common");
const _stringvalueutils = require("../../../../common/utils/string-value.utils");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
let SetupFlowService = class SetupFlowService {
    createSequentialChoicePending(params) {
        const players = Array.isArray(params.players) ? params.players : [];
        if (!players.length) return null;
        const startId = this.toPlayerId(params.startPlayerId);
        const startIndex = startId != null ? players.findIndex((p)=>this.toPlayerId(p?.id) === startId) : -1;
        const baseIndex = startIndex >= 0 ? startIndex : 0;
        let nextIndex = -1;
        for(let i = 0; i < players.length; i += 1){
            const idx = (baseIndex + i) % players.length;
            const pid = this.toPlayerId(players[idx]?.id);
            if (pid == null) continue;
            if (!params.isAssigned(pid)) {
                nextIndex = idx;
                break;
            }
        }
        if (nextIndex < 0) return null;
        const normalizedChoices = this.normalizeChoices(params.choices);
        if (!normalizedChoices.length) return null;
        const playerId = this.toPlayerId(players[nextIndex].id);
        if (playerId == null) return null;
        const playerLabel = this.playerLabel(players[nextIndex]);
        const label = typeof params.labelForPlayer === 'function' ? params.labelForPlayer(playerLabel) : `C'est à ${playerLabel} de faire un choix.`;
        const pending = {
            type: String(params.pendingType ?? '').trim() || 'setup_choice',
            playerId,
            blocking: true,
            label,
            choices: normalizedChoices.map((c)=>c.label),
            data: typeof params.dataBuilder === 'function' ? params.dataBuilder(normalizedChoices) : {
                choices: normalizedChoices
            }
        };
        return {
            pending,
            playerId,
            turnIndex: nextIndex
        };
    }
    createSequentialPawnPending(params) {
        const pawns = this.normalizePawnChoices(params.pawns);
        if (!pawns.length) return null;
        return this.createSequentialChoicePending({
            players: params.players,
            startPlayerId: params.startPlayerId,
            isAssigned: params.isAssigned,
            pendingType: String(params.pendingType ?? '').trim() || 'choose_pawn',
            choices: pawns.map((pawn)=>({
                    ...pawn,
                    label: typeof params.choiceLabelBuilder === 'function' ? String(params.choiceLabelBuilder(pawn) ?? pawn.label).trim() : pawn.label
                })),
            labelForPlayer: params.labelForPlayer ?? ((playerLabel)=>`C'est à ${playerLabel} de choisir son pion.`),
            dataBuilder: (availableChoices)=>({
                    ...params.extraPendingData ?? {},
                    ...params.includeChoiceMapData === true ? {
                        choices: availableChoices.map((choice)=>String(choice?.label ?? '').trim())
                    } : {},
                    pawns: availableChoices.map((choice)=>typeof params.pawnDataMapper === 'function' ? params.pawnDataMapper(choice) : this.defaultPawnData(choice))
                })
        });
    }
    toPlayerId(value) {
        const n = Number(value);
        return Number.isFinite(n) ? n : null;
    }
    resolveChoice(raw, options) {
        const normalizedOptions = Array.isArray(options) ? options : [];
        if (!normalizedOptions.length) return null;
        const value = typeof raw === 'object' && raw != null ? raw?.id ?? raw?.value ?? raw : raw;
        const key = this.normalizeKey(value);
        if (!key) return null;
        for (const option of normalizedOptions){
            const idKey = this.normalizeKey(option?.id);
            if (idKey && idKey === key) return option;
        }
        for (const option of normalizedOptions){
            const labelKey = this.normalizeKey(option?.label);
            if (labelKey && labelKey === key) return option;
        }
        return null;
    }
    resolvePawnChoice(raw, options) {
        const normalized = this.normalizePawnChoices(options).map((pawn)=>({
                ...pawn,
                label: pawn.label
            }));
        if (!normalized.length) return null;
        const candidate = typeof raw === 'object' && raw != null ? raw?.id ?? raw?.pawnId ?? raw?.pawn ?? raw?.value ?? raw?.label ?? raw : raw;
        return this.resolveChoice(candidate, normalized);
    }
    normalizeKey(value) {
        return (0, _stringvalueutils.stringOrEmpty)(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
    }
    normalizeChoices(choices) {
        return (Array.isArray(choices) ? choices : []).map((choice)=>({
                ...choice,
                id: (0, _stringvalueutils.stringOrEmpty)(choice?.id).trim(),
                label: (0, _stringvalueutils.stringOrEmpty)(choice?.label).trim()
            })).filter((choice)=>choice.id.length > 0 && choice.label.length > 0);
    }
    normalizePawnChoices(choices) {
        return (Array.isArray(choices) ? choices : []).map((choice)=>{
            const id = (0, _stringvalueutils.stringOrEmpty)(choice?.id).trim();
            const label = (0, _stringvalueutils.stringOrEmpty)(choice?.label ?? id).trim();
            return {
                ...choice,
                id,
                label
            };
        }).filter((choice)=>choice.id.length > 0 && choice.label.length > 0);
    }
    defaultPawnData(choice) {
        return {
            id: (0, _stringvalueutils.stringOrEmpty)(choice?.id).trim(),
            label: (0, _stringvalueutils.stringOrEmpty)(choice?.label).trim(),
            description: (0, _stringvalueutils.stringOrEmpty)(choice?.description).trim()
        };
    }
    playerLabel(player) {
        const username = (0, _stringvalueutils.stringOrEmpty)(player?.username).trim();
        if (username.length > 0) return username;
        const id = Number(player?.id ?? 0);
        return Number.isFinite(id) && id > 0 ? `Joueur ${id}` : 'Joueur';
    }
};
SetupFlowService = _ts_decorate([
    (0, _common.Injectable)()
], SetupFlowService);
