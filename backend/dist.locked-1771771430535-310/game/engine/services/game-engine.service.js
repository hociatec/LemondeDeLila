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
var GameEngineService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GameEngineService = void 0;
const common_1 = require("@nestjs/common");
const room_service_1 = require("../../../room/services/room.service");
const game_core_service_1 = require("../../core/services/game-core.service");
const game_registry_service_1 = require("./game-registry.service");
const turn_label_service_1 = require("../../modules/turn/services/turn-label.service");
const bot_runner_service_1 = require("../../modules/bot/services/bot-runner.service");
const bot_scheduler_service_1 = require("../../modules/bot/services/bot-scheduler.service");
const bot_settings_service_1 = require("../../modules/bot/services/bot-settings.service");
const game_engine_state_store_1 = require("./game-engine-state.store");
const validated_action_dto_1 = require("../dto/validated-action.dto");
const game_errors_1 = require("../../../common/errors/game-errors");
const game_logger_service_1 = require("../../../common/services/game-logger.service");
const game_stats_service_1 = require("../../../stats/services/game-stats.service");
const grid_render_service_1 = require("../../modules/grid/services/grid-render.service");
const shortcut_utils_1 = require("../shortcuts/shortcut-utils");
const action_service_helper_1 = require("../../actions/action-service.helper");
const mojibake_1 = require("../../../common/utils/mojibake");
let GameEngineService = class GameEngineService {
    static { GameEngineService_1 = this; }
    rooms;
    core;
    registry;
    turnLabel;
    botRunner;
    botScheduler;
    botSettings;
    gridRender;
    store;
    gameLogger;
    stats;
    broadcaster;
    endedBroadcaster;
    mutationQueue = new Map();
    exposedStateByUserCache = new WeakMap();
    static MAX_ACTIONS_PER_MESSAGE = 12;
    static MAX_ACTION_TYPE_LENGTH = 64;
    static MAX_ACTION_PAYLOAD_BYTES = 16 * 1024;
    static MAX_MESSAGE_PAYLOAD_BYTES = 64 * 1024;
    static BOT_THINKING_TTL_MS = 25_000;
    static FINISHED_STATE_GRACE_MS = 5_000;
    static nowMs() {
        return Date.now();
    }
    constructor(rooms, core, registry, turnLabel, botRunner, botScheduler, botSettings, gridRender, store, gameLogger, stats) {
        this.rooms = rooms;
        this.core = core;
        this.registry = registry;
        this.turnLabel = turnLabel;
        this.botRunner = botRunner;
        this.botScheduler = botScheduler;
        this.botSettings = botSettings;
        this.gridRender = gridRender;
        this.store = store;
        this.gameLogger = gameLogger;
        this.stats = stats;
    }
    setBroadcaster(fn) {
        this.broadcaster = fn;
    }
    setEndedBroadcaster(fn) {
        this.endedBroadcaster = fn;
    }
    async getState(roomId, gameType) {
        const internal = await this.enqueueMutation(this.buildKey(roomId, gameType), () => this.getInternalState(roomId, gameType));
        return this.exposeState(internal, gameType);
    }
    async getStateForUser(roomId, gameType, userId) {
        const internal = await this.enqueueMutation(this.buildKey(roomId, gameType), () => this.getInternalState(roomId, gameType));
        return this.exposeStateForUser(internal, gameType, userId);
    }
    exposeStateForUser(state, gameType, userId) {
        const cacheKey = `${gameType}|${userId}`;
        const byState = this.exposedStateByUserCache.get(state);
        const cached = byState?.get(cacheKey);
        if (cached) {
            return cached;
        }
        const label = this.turnLabel.compute(state, gameType);
        const handler = this.registry.getHandler(gameType);
        const exposed = handler?.exposeStateForUser
            ? handler.exposeStateForUser(state, userId)
            : handler?.exposeState
                ? handler.exposeState(state)
                : state;
        const withLabel = this.attachTurnLabel(exposed, label);
        const withDescriptors = this.attachUiDescriptors(this.gridRender.attachGridRenderDescriptors(this.attachViewerContext(this.attachCurrentPlayerView(withLabel), userId)));
        const withShortcuts = this.attachShortcuts(withDescriptors, handler);
        const finalState = (0, mojibake_1.fixMojibakeDeep)(this.stripBoardAndGridIfNotStarted(withShortcuts));
        if (byState) {
            byState.set(cacheKey, finalState);
        }
        else {
            this.exposedStateByUserCache.set(state, new Map([[cacheKey, finalState]]));
        }
        return finalState;
    }
    async handleKeyPress(roomId, gameType, userId, key) {
        const normalized = String(key ?? '')
            .trim()
            .toUpperCase();
        if (!normalized)
            return null;
        const state = await this.getStateForUser(roomId, gameType, userId);
        const handler = this.registry.getHandler(gameType);
        const declared = handler?.getShortcuts
            ? handler.getShortcuts({
                metadata: state?.metadata ?? {},
                currentPlayerId: state?.turn?.currentPlayerId ?? null,
                started: String(state?.status ?? '').toLowerCase() === 'started',
            })
            : [];
        const shortcuts = this.mergeCommonShortcuts(state, declared);
        const match = shortcuts.find((s) => {
            const rawKey = typeof s?.key === 'string' ? s.key : '';
            const prefix = 'pressed ';
            const k = rawKey.toLowerCase().startsWith(prefix)
                ? rawKey.substring(prefix.length).trim().toUpperCase()
                : rawKey.trim().toUpperCase();
            return k === normalized;
        });
        if (!match || typeof match !== 'object') {
            const status = String(state?.status ?? '')
                .toLowerCase()
                .trim();
            if (normalized === 'X') {
                return { kind: 'room', op: 'reset' };
            }
            if (normalized === 'ENTER') {
                if (status === 'finished') {
                    return { kind: 'room', op: 'restart' };
                }
                if (status !== 'started') {
                    return { kind: 'room', op: 'start' };
                }
            }
            return null;
        }
        if (match.type === 'action') {
            const actionType = String(match.actionType ?? '').trim();
            if (!actionType)
                return null;
            return { kind: 'action', actions: [{ type: actionType, payload: {} }] };
        }
        if (match.type === 'interface') {
            const panelId = String(match.id ?? '').trim();
            if (!panelId)
                return null;
            const extras = GameEngineService_1.extractExtras(state);
            const ui = GameEngineService_1.extractUi(extras);
            const panels = GameEngineService_1.extractPanels(ui);
            const panel = panels
                ? panels[panelId]
                : undefined;
            let message = GameEngineService_1.extractPanelMessage(panel);
            if (!message && panelId === 'turn') {
                const status = String(state?.status ?? '')
                    .toLowerCase()
                    .trim();
                if (status === 'finished') {
                    message = 'Partie terminée.';
                }
                else if (status !== 'started') {
                    message = 'Partie non démarrée.';
                }
                else if (typeof state?.turn?.label === 'string' &&
                    state.turn.label.trim()) {
                    message = state.turn.label.trim();
                }
                else {
                    const currentPlayerId = typeof state?.turn?.currentPlayerId === 'number' &&
                        Number.isFinite(state.turn.currentPlayerId)
                        ? state.turn.currentPlayerId
                        : null;
                    const players = state.players ?? [];
                    const name = currentPlayerId != null
                        ? String(players.find((p) => Number(p.id) === currentPlayerId)
                            ?.username ?? '').trim()
                        : '';
                    if (currentPlayerId != null && currentPlayerId === userId) {
                        message = 'À toi de jouer.';
                    }
                    else if (currentPlayerId != null && name) {
                        message = `C'est au tour de ${name}.`;
                    }
                    else if (currentPlayerId != null) {
                        message = `C'est au tour du joueur ${currentPlayerId}.`;
                    }
                    else {
                        message = 'Tour en cours indisponible.';
                    }
                }
            }
            return message
                ? {
                    kind: 'panel',
                    panelId,
                    message: (0, mojibake_1.fixMojibakeString)(message),
                }
                : null;
        }
        return null;
    }
    async refreshAndBroadcast(roomId, gameType) {
        const state = await this.getInternalState(roomId, gameType);
        this.broadcaster?.(gameType, roomId, state);
    }
    attachShortcuts(state, handler) {
        const extras = GameEngineService_1.extractExtras(state);
        const declared = handler?.getShortcuts
            ? handler.getShortcuts({
                metadata: state.metadata ?? {},
                currentPlayerId: state.turn?.currentPlayerId ?? null,
                started: String(state.status ?? '').toLowerCase() === 'started',
            })
            : [];
        const shortcuts = this.mergeCommonShortcuts(state, declared);
        return {
            ...state,
            extras: {
                ...extras,
                shortcuts,
            },
        };
    }
    mergeCommonShortcuts(state, declared) {
        const common = [];
        common.push((0, shortcut_utils_1.interfaceShortcut)('T', 'turn'));
        common.push((0, shortcut_utils_1.interfaceShortcut)('Ctrl+R', 'rules'));
        const actions = Array.isArray(state?.actions)
            ? state.actions
            : [];
        const types = new Set(actions
            .map((a) => typeof a?.type === 'string' ? a.type.trim().toLowerCase() : '')
            .filter((t) => t));
        const hasRoll = Array.isArray(actions)
            ? actions.some((a) => (0, action_service_helper_1.isRollActionType)(a?.type))
            : false;
        if (hasRoll) {
            common.push((0, shortcut_utils_1.actionShortcut)('ENTER', 'roll'));
        }
        if (types.has('draw')) {
            common.push((0, shortcut_utils_1.actionShortcut)('SPACE', 'draw'));
        }
        if (types.has('lama_pass')) {
            common.push((0, shortcut_utils_1.actionShortcut)('S', 'lama_pass'));
        }
        const out = [];
        const seen = new Set();
        for (const s of [...(Array.isArray(declared) ? declared : []), ...common]) {
            const keyStr = s.key;
            const typeStr = s.type;
            const idStr = typeStr === 'interface' ? String(s.id ?? '') : '';
            const actionTypeStr = typeStr === 'action' ? String(s.actionType ?? '') : '';
            const sig = `${keyStr}|${typeStr}|${idStr}|${actionTypeStr}`;
            if (!keyStr || !typeStr)
                continue;
            if (seen.has(sig))
                continue;
            seen.add(sig);
            out.push(s);
        }
        return out;
    }
    async getInternalState(roomId, gameType) {
        let payload;
        try {
            payload = await this.rooms.getRoomPayload(roomId);
        }
        catch (err) {
            this.cleanupRoom(roomId, gameType);
            if (this.isRoomNotFound(err)) {
                throw new common_1.NotFoundException('Table introuvable');
            }
            throw err;
        }
        const actualGameType = String(payload?.room?.gameType ?? '').trim();
        if (actualGameType && actualGameType !== gameType) {
            this.cleanupRoom(roomId, gameType);
            throw new common_1.BadRequestException('Type de jeu invalide pour cette table');
        }
        const existing = await this.store.get(roomId, gameType);
        if (existing) {
            const metadata = this.toMetadata(existing);
            const previousStatus = String(existing.status ?? '').toLowerCase();
            const roomStatus = String(payload.room.status ?? '').toLowerCase();
            const storedStartedAt = this.normalizeMetadataString(metadata['roomStartedAt']);
            const roomStartedAt = this.normalizeMetadataString(payload.room.startedAt);
            const maybeFinished = previousStatus === 'finished'
                ? existing
                : this.forceFinishedIfWinnerDetected(existing);
            const maybeFinishedStatus = String(maybeFinished?.status ?? '').toLowerCase();
            if (roomStatus === 'started' && maybeFinishedStatus === 'finished') {
                if (this.isWithinFinishedGraceWindow(maybeFinished)) {
                    await this.scheduleFinishedRoomReset(roomId, gameType, maybeFinished);
                    return maybeFinished;
                }
                this.gameLogger.warn('Stale finished game detected while room is started; auto-resetting room', {
                    roomId,
                    gameType,
                    previousStatus,
                    roomStatus,
                });
                try {
                    await this.rooms.resetRoomSystem(roomId);
                }
                catch (err) {
                    this.gameLogger.error('Auto-reset room (stale finished) failed', err instanceof Error ? err : undefined, { roomId, gameType });
                }
                try {
                    await this.store.delete(roomId, gameType);
                }
                catch (err) {
                    this.gameLogger.error('Auto-reset game state (stale finished) failed', err instanceof Error ? err : undefined, { roomId, gameType });
                }
                try {
                    await this.rooms.notifyRoomStateUpdated(roomId);
                }
                catch {
                }
                try {
                    payload = await this.rooms.getRoomPayload(roomId);
                }
                catch (err) {
                    this.cleanupRoom(roomId, gameType);
                    if (this.isRoomNotFound(err)) {
                        throw new common_1.NotFoundException('Table introuvable');
                    }
                    throw err;
                }
                this.cleanupRoom(roomId, gameType);
                const rebuilt = this.buildInitialState(payload, gameType);
                const marked = await this.normalizeBotThinking(roomId, gameType, await this.markBotThinking(roomId, gameType, rebuilt));
                await this.scheduleBotTurn(roomId, gameType, marked);
                return marked;
            }
            const storedRunId = this.parseMetadataNumber(metadata['roomRunId']);
            const roomRunId = this.parseMetadataNumber(payload.room.runId);
            const hasRunId = storedRunId !== null &&
                roomRunId !== null &&
                roomRunId >= 0 &&
                storedRunId >= 0;
            const hasRunIdChanged = hasRunId && storedRunId !== roomRunId;
            const hasMeaningfulStartedAtChange = (() => {
                if (!storedStartedAt || !roomStartedAt)
                    return false;
                const a = Date.parse(storedStartedAt);
                const b = Date.parse(roomStartedAt);
                if (Number.isFinite(a) && Number.isFinite(b)) {
                    return Math.abs(a - b) > 2000;
                }
                return storedStartedAt !== roomStartedAt;
            })();
            if (previousStatus === 'started' &&
                roomStatus &&
                roomStatus !== 'started' &&
                roomStatus !== 'finished') {
                this.gameLogger.info('Game state reset detected', {
                    roomId,
                    gameType,
                    previousStatus,
                    roomStatus,
                });
                this.cleanupRoom(roomId, gameType);
                const rebuilt = this.buildInitialState(payload, gameType);
                const marked = await this.normalizeBotThinking(roomId, gameType, await this.markBotThinking(roomId, gameType, rebuilt));
                await this.scheduleBotTurn(roomId, gameType, marked);
                return marked;
            }
            const synced = this.store.syncRoomStatus(existing, payload);
            const withRoster = this.syncRosterForStartedRoom(synced, payload);
            if (withRoster !== synced) {
                try {
                    await this.store.set(roomId, gameType, withRoster);
                }
                catch {
                }
            }
            const nextStatus = String(withRoster.status ?? '').toLowerCase();
            const currentPlayers = existing.players?.length ?? 0;
            const incomingPlayers = (payload.room.players?.length ?? 0) + (payload.room.bots?.length ?? 0);
            const gameStarted = (existing.status || '').toLowerCase() === 'started';
            this.gameLogger.debug('Retrieved game state', {
                roomId,
                gameType,
                status: withRoster.status,
                turnIndex: withRoster.turnIndex,
                currentPlayerId: withRoster.turn?.currentPlayerId ?? null,
                players: withRoster.players?.map((p) => ({
                    id: p.id,
                    isBot: Boolean(p.isBot),
                })) ?? [],
                incomingPlayers,
                gameStarted,
            });
            if (previousStatus !== 'started' && nextStatus === 'started') {
                const rebuilt = this.buildInitialState(payload, gameType);
                const marked = await this.normalizeBotThinking(roomId, gameType, await this.markBotThinking(roomId, gameType, rebuilt));
                await this.scheduleBotTurn(roomId, gameType, marked);
                return marked;
            }
            if (previousStatus === 'started' &&
                nextStatus === 'started' &&
                roomStartedAt &&
                storedStartedAt &&
                (hasRunIdChanged || hasMeaningfulStartedAtChange)) {
                this.gameLogger.info('Game state rebuild (startedAt changed)', {
                    roomId,
                    gameType,
                    storedStartedAt,
                    roomStartedAt,
                    storedRunId: storedRunId ?? null,
                    roomRunId: roomRunId ?? null,
                });
                this.cleanupRoom(roomId, gameType);
                const rebuilt = this.buildInitialState(payload, gameType);
                const marked = await this.normalizeBotThinking(roomId, gameType, await this.markBotThinking(roomId, gameType, rebuilt));
                await this.scheduleBotTurn(roomId, gameType, marked);
                return marked;
            }
            if (!gameStarted && incomingPlayers !== currentPlayers) {
                const rebuilt = this.buildInitialState(payload, gameType);
                const marked = await this.normalizeBotThinking(roomId, gameType, await this.markBotThinking(roomId, gameType, rebuilt));
                await this.scheduleBotTurn(roomId, gameType, marked);
                return marked;
            }
            const normalized = await this.normalizeBotThinking(roomId, gameType, withRoster);
            const forcedFinished = this.forceFinishedIfWinnerDetected(normalized);
            if (forcedFinished !== normalized) {
                try {
                    await this.store.set(roomId, gameType, forcedFinished);
                }
                catch {
                }
            }
            await this.scheduleBotTurn(roomId, gameType, forcedFinished);
            return forcedFinished;
        }
        const state = this.buildInitialState(payload, gameType);
        const marked = await this.normalizeBotThinking(roomId, gameType, await this.markBotThinking(roomId, gameType, state));
        await this.scheduleBotTurn(roomId, gameType, marked);
        return marked;
    }
    async applyActions(roomId, gameType, actions, actorId, allowBotTurn = false) {
        return this.enqueueMutation(this.buildKey(roomId, gameType), () => this.applyActionsInternal(roomId, gameType, actions, actorId, allowBotTurn));
    }
    async applyActionsInternal(roomId, gameType, actions, actorId, allowBotTurn = false, botActorIdOverride = null) {
        const current = await this.normalizeBotThinking(roomId, gameType, await this.getInternalState(roomId, gameType));
        if (allowBotTurn) {
            this.botScheduler.clear(this.buildKey(roomId, gameType));
        }
        if ((current.status || '').toLowerCase() === 'finished') {
            return this.exposeState(current, gameType);
        }
        const handler = this.registry.getHandler(gameType);
        if (!allowBotTurn && (!actorId || Number.isNaN(actorId))) {
            throw new common_1.UnauthorizedException('Authentification requise pour jouer.');
        }
        const currentPlayerId = current.turn?.currentPlayerId ?? null;
        const currentPlayer = current.players?.find((p) => p.id === currentPlayerId);
        const actingPlayer = actorId != null && Number.isFinite(actorId)
            ? (current.players?.find((p) => p.id === actorId) ?? null)
            : null;
        if (!allowBotTurn) {
            if (!actingPlayer || actingPlayer.isBot) {
                throw new common_1.UnauthorizedException('Mode spectateur : action de jeu interdite');
            }
        }
        const allowOutOfTurnActions = (() => {
            if (allowBotTurn)
                return false;
            if (!handler?.getAvailableActions)
                return false;
            if (actorId == null || Number.isNaN(actorId))
                return false;
            if (currentPlayerId == null || actorId === currentPlayerId)
                return false;
            const available = handler.getAvailableActions(current, actorId) ?? [];
            if (!Array.isArray(available) || available.length === 0)
                return false;
            const allowedTypes = new Set(available
                .map((a) => this.normalizeActionType(a.type))
                .filter((t) => t.length > 0));
            if (allowedTypes.size === 0)
                return false;
            const requestedTypes = (Array.isArray(actions) ? actions : [])
                .map((a) => this.normalizeActionType(a.type))
                .filter((t) => t.length > 0);
            if (requestedTypes.length === 0)
                return false;
            return requestedTypes.every((t) => allowedTypes.has(t));
        })();
        if (!allowBotTurn && current.botThinking && !allowOutOfTurnActions) {
            if (currentPlayer?.isBot) {
                return this.exposeState(current, gameType);
            }
        }
        const actorOverride = allowOutOfTurnActions ||
            handler?.validateActor?.(current, actions, actorId ?? null) === true;
        if (!allowBotTurn && !actorOverride) {
            if (currentPlayer?.isBot) {
                return this.exposeState(current, gameType);
            }
            if (currentPlayerId !== actorId) {
                return this.exposeState(current, gameType);
            }
        }
        const botActorId = allowBotTurn
            ? (botActorIdOverride ?? currentPlayerId)
            : null;
        if (allowBotTurn && botActorId == null) {
            throw new common_1.BadRequestException('Action bot invalide : acteur introuvable.');
        }
        if (allowBotTurn && typeof botActorId === 'number') {
            const bot = current.players?.find((p) => p.id === botActorId) ?? null;
            if (!bot?.isBot) {
                throw new common_1.BadRequestException('Action bot invalide.');
            }
        }
        const actorLabel = allowBotTurn ? 'bot' : 'human';
        const validatedActions = await this.validateActions(current, handler, actions, allowBotTurn ? botActorId : actorId);
        const sanitizedActions = validatedActions.map((action) => ({
            ...action,
            meta: {
                ...(action?.meta ?? {}),
                actor: actorLabel,
                actorId: allowBotTurn ? botActorId : actorId,
            },
        }));
        this.gameLogger.logPlayerAction({
            type: 'apply_actions',
            payload: {
                actions: sanitizedActions.map((a) => ({
                    type: a.type,
                    hasPayload: Boolean(a.payload),
                })),
                allowBotTurn,
            },
        }, {
            roomId,
            gameType,
            playerId: allowBotTurn
                ? (botActorId ?? undefined)
                : (actorId ?? undefined),
            turnIndex: current.turnIndex,
            action: {
                status: current.status,
                currentPlayerId,
            },
        });
        if (!handler) {
            const next = this.core.appendLog(current, `Type de jeu non spécialisé: ${gameType}`);
            const marked = await this.markBotThinking(roomId, gameType, next);
            await this.scheduleBotTurn(roomId, gameType, marked);
            this.broadcaster?.(gameType, roomId, marked);
            return this.exposeState(marked, gameType);
        }
        const next = handler.applyActions(current, sanitizedActions);
        const botTurn = this.isBotTurn(next);
        let marked = await this.markBotThinking(roomId, gameType, next, botTurn);
        const drawAction = sanitizedActions.find((a) => this.isDrawAction(a));
        if (drawAction) {
            const actionPlayerId = allowBotTurn
                ? (botActorId ?? null)
                : (actorId ?? null);
            marked = {
                ...marked,
                lastDraw: { playerId: actionPlayerId, at: new Date().toISOString() },
            };
        }
        marked = this.normalizeWinnerMetadata(marked);
        marked = this.forceFinishedIfWinnerDetected(marked);
        marked = this.appendBoardArrivalAnnouncements(gameType, handler, current, marked);
        marked = this.appendSkipTurnAnnouncements(marked);
        if ((marked.status || '').toLowerCase() === 'finished') {
            const metadata = this.toMetadata(marked);
            const obj = { ...metadata };
            const { winnerId, outcomesByPlayerId } = this.deriveFinishedOutcomes(marked);
            marked = {
                ...marked,
                metadata: {
                    ...obj,
                    finishedAt: new Date().toISOString(),
                    ...(winnerId != null ? { winnerId, winnerPlayerId: winnerId } : {}),
                    ...(outcomesByPlayerId ? { outcomesByPlayerId } : {}),
                },
            };
        }
        await this.store.set(roomId, gameType, marked, { asyncPersist: true });
        await this.scheduleBotTurn(roomId, gameType, marked);
        this.broadcaster?.(gameType, roomId, marked);
        if ((marked.status || '').toLowerCase() === 'finished') {
            try {
                await this.stats.finalizeFinished(roomId, marked);
            }
            catch (err) {
                this.gameLogger.error('Finalize finished game failed', err instanceof Error ? err : undefined, { roomId, gameType });
            }
            try {
                const endedPayload = this.buildEndedPayload(roomId, gameType, marked);
                this.endedBroadcaster?.(gameType, roomId, marked, endedPayload);
            }
            catch (err) {
                this.gameLogger.error('Broadcast game.ended failed', err instanceof Error ? err : undefined, { roomId, gameType });
            }
            try {
                await this.scheduleFinishedRoomReset(roomId, gameType, marked);
            }
            catch (err) {
                this.gameLogger.error('Schedule finished game reset failed', err instanceof Error ? err : undefined, { roomId, gameType });
            }
            this.botScheduler.clear(this.buildKey(roomId, gameType));
        }
        this.gameLogger.debug('Actions applied successfully', {
            roomId,
            gameType,
            playerId: actorId ?? undefined,
            turnIndex: marked.turnIndex,
            action: {
                status: marked.status,
                currentPlayerId: marked.turn?.currentPlayerId ?? null,
                isBotTurn: botTurn,
                botThinking: marked.botThinking ?? false,
            },
        });
        return this.exposeState(marked, gameType);
    }
    toMetadata(target) {
        const meta = target.metadata;
        if (meta && typeof meta === 'object' && !Array.isArray(meta)) {
            return meta;
        }
        return {};
    }
    normalizeMetadataString(value) {
        if (typeof value === 'string') {
            return value.trim();
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return String(value).trim();
        }
        return '';
    }
    parseMetadataNumber(value) {
        if (typeof value === 'number' && Number.isFinite(value)) {
            return value;
        }
        if (typeof value === 'string') {
            const normalized = value.trim();
            if (!normalized) {
                return null;
            }
            const parsed = Number(normalized);
            return Number.isFinite(parsed) ? parsed : null;
        }
        return null;
    }
    getMetadataObject(metadata, key) {
        const value = metadata[key];
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            return value;
        }
        return null;
    }
    normalizeWinnerMetadata(state) {
        const meta = this.toMetadata(state);
        if (Object.keys(meta).length === 0)
            return state;
        const winnerId = meta?.winnerId;
        if (winnerId !== null && winnerId !== undefined) {
            if (typeof winnerId !== 'string' || winnerId.trim().length > 0) {
                return state;
            }
        }
        for (const key of ['winnerPlayerId', 'winner_id']) {
            const value = meta[key];
            if (value === null || value === undefined)
                continue;
            if (typeof value === 'string' && value.trim().length === 0)
                continue;
            return {
                ...state,
                metadata: {
                    ...meta,
                    winnerId: value,
                },
            };
        }
        return state;
    }
    normalizeUsernameForLog(username) {
        let name = '';
        if (typeof username === 'string') {
            name = username.trim();
        }
        else if (typeof username === 'number' || typeof username === 'boolean') {
            name = String(username).trim();
        }
        else {
            return '';
        }
        name = name
            .replace(/[\r\n\t]+/g, ' ')
            .replace(/\s{2,}/g, ' ')
            .trim();
        if (name.startsWith('"') && name.endsWith('"')) {
            name = name.slice(1, -1).trim();
        }
        const lowered = name.toLowerCase();
        if (lowered.endsWith('(zone de jeu)') ||
            lowered.endsWith('(zone de jeux)') ||
            lowered.endsWith('(game zone)')) {
            const openParen = name.lastIndexOf('(');
            if (openParen > 0) {
                name = name.slice(0, openParen).trimEnd();
            }
        }
        return name;
    }
    buildPlayersFromPayload(payload) {
        const result = [];
        const roomPlayers = Array.isArray(payload?.room?.players)
            ? payload.room.players
            : [];
        for (const player of roomPlayers) {
            const pid = typeof player?.id === 'number' ? player.id : Number(player?.id ?? NaN);
            if (!Number.isFinite(pid) || pid === 0)
                continue;
            result.push({
                id: pid,
                username: this.normalizeUsernameForLog(player.username) || `Joueur ${pid}`,
                isBot: false,
            });
        }
        const roomBots = Array.isArray(payload?.room?.bots)
            ? payload.room.bots
            : [];
        for (const bot of roomBots) {
            const rawId = typeof bot?.id === 'number'
                ? bot.id
                : typeof bot?.id === 'string'
                    ? Number(bot.id)
                    : NaN;
            if (!Number.isFinite(rawId))
                continue;
            const pid = -Math.abs(rawId);
            if (pid === 0)
                continue;
            result.push({
                id: pid,
                username: this.normalizeUsernameForLog(bot.name) || `Bot ${Math.abs(pid)}`,
                isBot: true,
            });
        }
        return result;
    }
    normalizeActionType(value) {
        if (typeof value !== 'string') {
            return '';
        }
        return value.trim().toLowerCase();
    }
    isDrawAction(action) {
        const type = this.normalizeActionType(action.type);
        return type === 'draw' || type === 'draw_card';
    }
    forceFinishedIfWinnerDetected(state) {
        const status = String(state?.status ?? '').toLowerCase();
        if (status !== 'started') {
            return state;
        }
        const meta = this.toMetadata(state);
        if (Object.keys(meta).length === 0) {
            return state;
        }
        const finishedAt = this.normalizeMetadataString(meta['finishedAt']);
        if (finishedAt.length > 0) {
            return state.status === 'finished'
                ? state
                : { ...state, status: 'finished' };
        }
        const outcomes = meta['outcomesByPlayerId'];
        if (outcomes &&
            typeof outcomes === 'object' &&
            Object.keys(outcomes).length > 0) {
            return state.status === 'finished'
                ? state
                : { ...state, status: 'finished' };
        }
        for (const key of ['winnerPlayerId', 'winnerId', 'winner_id']) {
            const value = meta[key];
            if (value === null || value === undefined) {
                continue;
            }
            if (typeof value === 'string' && value.trim().length === 0) {
                continue;
            }
            const normalizedMeta = key === 'winnerId'
                ? meta
                : {
                    ...meta,
                    winnerId: value,
                };
            return {
                ...state,
                status: 'finished',
                metadata: normalizedMeta,
            };
        }
        return state;
    }
    deriveFinishedOutcomes(state) {
        const players = state.players ?? [];
        const humans = players.filter((p) => !p.isBot);
        const metadata = this.toMetadata(state);
        const winnerFromMeta = this.tryReadWinnerId(metadata);
        const existingOutcomes = this.tryReadOutcomesByPlayerId(metadata);
        let winnerId = winnerFromMeta;
        if (winnerId == null && existingOutcomes) {
            const winners = Object.entries(existingOutcomes)
                .filter(([, v]) => v === 'won')
                .map(([k]) => Number(k))
                .filter((n) => Number.isFinite(n));
            if (winners.length === 1) {
                winnerId = winners[0];
            }
        }
        let outcomesByPlayerId = null;
        if (existingOutcomes && Object.keys(existingOutcomes).length > 0) {
            outcomesByPlayerId = existingOutcomes;
        }
        else if (winnerId != null) {
            outcomesByPlayerId = Object.fromEntries(humans.map((p) => [String(p.id), p.id === winnerId ? 'won' : 'lost']));
        }
        return { winnerId, outcomesByPlayerId };
    }
    buildEndedPayload(roomId, gameType, state) {
        const metadata = this.toMetadata(state);
        const { winnerId, outcomesByPlayerId } = this.deriveFinishedOutcomes(state);
        const players = state.players ?? [];
        const playersById = {};
        for (const p of players) {
            const id = typeof p?.id === 'number' && Number.isFinite(p.id) ? p.id : null;
            if (id == null) {
                continue;
            }
            const username = this.normalizeUsernameForLog(p.username);
            if (!username) {
                continue;
            }
            playersById[String(id)] = username;
        }
        const outcomes = {};
        if (outcomesByPlayerId) {
            for (const [playerId, raw] of Object.entries(outcomesByPlayerId)) {
                const normalized = String(raw ?? '')
                    .trim()
                    .toLowerCase();
                if (normalized === 'won' ||
                    normalized === 'lost' ||
                    normalized === 'draw' ||
                    normalized === 'unknown') {
                    outcomes[String(playerId)] = normalized;
                    continue;
                }
                outcomes[String(playerId)] = 'unknown';
            }
        }
        const finishedAtRaw = metadata['finishedAt'];
        const finishedAt = typeof finishedAtRaw === 'string' && finishedAtRaw.trim().length > 0
            ? finishedAtRaw.trim()
            : new Date().toISOString();
        const turnIndex = typeof state?.turnIndex === 'number' && Number.isFinite(state.turnIndex)
            ? state.turnIndex
            : null;
        return {
            roomId,
            gameType,
            status: 'finished',
            finishedAt,
            winnerPlayerId: winnerId ?? null,
            outcomesByPlayerId: outcomes,
            playersById,
            turnIndex,
        };
    }
    tryReadWinnerId(meta) {
        for (const key of ['winnerId', 'winnerPlayerId', 'winner_id']) {
            const raw = meta[key];
            if (typeof raw === 'number' && Number.isFinite(raw)) {
                return raw;
            }
            if (typeof raw === 'string' && raw.trim().length > 0) {
                const n = Number(raw.trim());
                if (Number.isFinite(n)) {
                    return n;
                }
            }
        }
        return null;
    }
    tryReadOutcomesByPlayerId(meta) {
        const rawOutcomes = meta.outcomesByPlayerId;
        if (!rawOutcomes || typeof rawOutcomes !== 'object') {
            return null;
        }
        const out = {};
        for (const [key, value] of Object.entries(rawOutcomes)) {
            const normalized = this.normalizeMetadataString(value).toLowerCase();
            if (normalized !== 'won' && normalized !== 'lost') {
                continue;
            }
            out[String(key)] = normalized;
        }
        return Object.keys(out).length > 0 ? out : null;
    }
    async playBotTurn(roomId, gameType) {
        return this.enqueueMutation(this.buildKey(roomId, gameType), () => this.playBotTurnInternal(roomId, gameType));
    }
    async playBotTurnInternal(roomId, gameType) {
        this.gameLogger.debug('Bot turn tick', { roomId, gameType });
        const state = await this.normalizeBotThinking(roomId, gameType, await this.getInternalState(roomId, gameType));
        const key = this.buildKey(roomId, gameType);
        this.botScheduler.clear(key);
        const handler = this.registry.getHandler(gameType);
        const botActorId = this.getBotActorIdForState(state, handler);
        const botPlayer = botActorId != null
            ? state.players?.find((p) => p.id === botActorId)
            : null;
        if (!botPlayer || !botPlayer.isBot || botActorId == null) {
            return this.exposeState(state, gameType);
        }
        let botActions = this.botRunner.suggestForHandler(handler, state, botActorId);
        if (!botActions || botActions.length === 0) {
            const fallback = handler?.getAvailableActions
                ? handler.getAvailableActions(state, botActorId)
                : [];
            if (Array.isArray(fallback) &&
                fallback.length > 0 &&
                botActorId != null) {
                botActions = this.botRunner.choose(fallback, {
                    state,
                    playerId: botActorId,
                });
            }
        }
        if (!botActions || botActions.length === 0) {
            this.gameLogger.warn('Bot has no available actions', {
                roomId,
                gameType,
                playerId: botActorId ?? undefined,
                action: {
                    status: state.status,
                },
            });
            const marked = await this.markBotThinking(roomId, gameType, state, false);
            this.broadcaster?.(gameType, roomId, marked);
            return this.exposeState(marked, gameType);
        }
        this.gameLogger.logPlayerAction({
            type: 'bot_play',
            payload: {
                actions: botActions.map((a) => a.type),
            },
        }, {
            roomId,
            gameType,
            playerId: botActorId ?? undefined,
            action: {
                isBot: botPlayer.isBot,
                status: state.status,
            },
        });
        await this.applyActionsInternal(roomId, gameType, botActions, null, true, botActorId);
        const updated = (await this.store.get(roomId, gameType)) ?? state;
        return this.exposeState(updated, gameType);
    }
    enqueueMutation(key, task) {
        const previous = this.mutationQueue.get(key) ?? Promise.resolve();
        const next = previous.then(task, task);
        this.mutationQueue.set(key, next);
        next
            .finally(() => {
            if (this.mutationQueue.get(key) === next) {
                this.mutationQueue.delete(key);
            }
        })
            .catch(() => { });
        return next;
    }
    syncRosterForStartedRoom(state, payload) {
        try {
            let changed = false;
            if (!state ||
                String(state.status ?? '')
                    .toLowerCase()
                    .trim() !== 'started') {
                return state;
            }
            let players = state.players ?? [];
            const desiredPlayers = this.buildPlayersFromPayload(payload);
            if (players.length === 0 && desiredPlayers.length === 0) {
                return state;
            }
            if (desiredPlayers.length > 0) {
                const same = players.length === desiredPlayers.length &&
                    players.every((p, i) => p?.id === desiredPlayers[i]?.id);
                if (!same) {
                    players = desiredPlayers;
                    changed = true;
                }
            }
            const roomPlayers = Array.isArray(payload?.room?.players)
                ? payload.room.players
                : [];
            const roomBots = Array.isArray(payload?.room?.bots)
                ? payload.room.bots
                : [];
            const humanById = new Map();
            for (const p of roomPlayers) {
                const id = p.id;
                if (!Number.isFinite(id) || id <= 0)
                    continue;
                const username = this.normalizeUsernameForLog(p.username);
                if (!username)
                    continue;
                humanById.set(id, username);
            }
            const roomBotNames = roomBots
                .map((b) => this.normalizeUsernameForLog(b.name))
                .filter((n) => n.length > 0);
            const allowedBotNames = new Set(roomBotNames);
            const allowedBotIds = new Set(roomBots
                .map((b) => -Math.abs(b.id))
                .filter((id) => Number.isFinite(id) && id < 0));
            const assignedBotNames = new Set(players
                .filter((p) => p.isBot === true)
                .map((p) => this.normalizeUsernameForLog(p.username))
                .filter((n) => n.length > 0));
            const availableBotNames = [];
            for (const name of roomBotNames) {
                if (!assignedBotNames.has(name)) {
                    availableBotNames.push(name);
                }
            }
            const mappedPlayers = players.map((p) => {
                const id = p.id;
                if (!Number.isFinite(id) || id === 0)
                    return p;
                const roomUsername = humanById.get(id) ?? null;
                const isBot = p.isBot === true;
                if (roomUsername) {
                    if (isBot ||
                        this.normalizeUsernameForLog(p.username) !== roomUsername) {
                        changed = true;
                        return { ...p, isBot: false, username: roomUsername };
                    }
                    return p;
                }
                if (!isBot && availableBotNames.length > 0) {
                    const botName = availableBotNames.shift();
                    changed = true;
                    return { ...p, isBot: true, username: botName };
                }
                return p;
            });
            const filteredPlayers = mappedPlayers.filter((p) => {
                const id = p.id;
                if (!Number.isFinite(id) || id === 0)
                    return true;
                const isBot = p.isBot === true;
                if (id < 0) {
                    if (!isBot)
                        return true;
                    return allowedBotIds.has(id);
                }
                if (!isBot)
                    return true;
                const name = this.normalizeUsernameForLog(p.username);
                return Boolean(name && allowedBotNames.has(name));
            });
            const nextPlayers = filteredPlayers;
            if (nextPlayers.length !== mappedPlayers.length) {
                changed = true;
            }
            const currentPlayerId = state.turn?.currentPlayerId ?? null;
            if (typeof currentPlayerId === 'number' &&
                currentPlayerId !== 0 &&
                !nextPlayers.some((p) => p?.id === currentPlayerId)) {
                const prevIndex = Math.max(0, players.findIndex((p) => p?.id === currentPlayerId));
                const fallbackIndex = Math.min(prevIndex, Math.max(0, nextPlayers.length - 1));
                const fallbackId = nextPlayers[fallbackIndex]?.id ?? nextPlayers[0]?.id ?? null;
                if (fallbackId !== currentPlayerId) {
                    changed = true;
                    state = {
                        ...state,
                        turn: {
                            ...(state.turn ?? { direction: 1 }),
                            currentPlayerId: fallbackId,
                        },
                    };
                }
            }
            const pendingPlayerId = state.pending?.playerId ?? null;
            if (typeof pendingPlayerId === 'number' &&
                pendingPlayerId !== 0 &&
                !nextPlayers.some((p) => p?.id === pendingPlayerId)) {
                changed = true;
                state = {
                    ...state,
                    pending: state.pending
                        ? { ...state.pending, playerId: null }
                        : state.pending,
                };
            }
            return changed ? { ...state, players: nextPlayers } : state;
        }
        catch {
            return state;
        }
    }
    async exportInternalState(roomId, gameType) {
        if (!Number.isFinite(roomId) || roomId <= 0)
            return null;
        const gt = String(gameType ?? '').trim();
        if (!gt)
            return null;
        const internal = await this.enqueueMutation(this.buildKey(roomId, gt), () => this.getInternalState(roomId, gt));
        return internal ?? null;
    }
    async restoreInternalState(roomId, gameType, state) {
        if (!Number.isFinite(roomId) || roomId <= 0) {
            throw new Error('roomId invalide');
        }
        const gt = String(gameType ?? '').trim();
        if (!gt) {
            throw new Error('gameType invalide');
        }
        await this.enqueueMutation(this.buildKey(roomId, gt), async () => {
            await this.store.set(roomId, gt, state);
            const marked = await this.normalizeBotThinking(roomId, gt, await this.markBotThinking(roomId, gt, state));
            await this.scheduleBotTurn(roomId, gt, marked);
            this.broadcaster?.(gt, roomId, marked);
        });
    }
    isBotTurn(state) {
        if (state.status === 'finished')
            return false;
        const currentId = state.turn?.currentPlayerId ?? null;
        const currentPlayer = state.players?.find((p) => p.id === currentId);
        return Boolean(currentPlayer?.isBot);
    }
    getBotActorIdForState(state, handler) {
        if ((state.status || '').toLowerCase() === 'finished')
            return null;
        const hasAvailableActions = (playerId) => {
            if (!handler?.getAvailableActions) {
                return true;
            }
            try {
                const available = handler.getAvailableActions(state, playerId);
                return !Array.isArray(available) || available.length > 0;
            }
            catch {
                return true;
            }
        };
        const pending = state.pending ?? null;
        const pendingPlayerIdRaw = pending?.playerId;
        const pendingPlayerId = pendingPlayerIdRaw != null && Number.isFinite(Number(pendingPlayerIdRaw))
            ? Number(pendingPlayerIdRaw)
            : null;
        if (typeof pendingPlayerId === 'number') {
            const pendingPlayer = state.players?.find((p) => p.id === pendingPlayerId) ?? null;
            if (pendingPlayer?.isBot) {
                if (hasAvailableActions(pendingPlayerId)) {
                    return pendingPlayerId;
                }
                return null;
            }
            if (pending?.blocking === true) {
                return null;
            }
        }
        const currentId = state.turn?.currentPlayerId ?? null;
        const currentPlayer = state.players?.find((p) => p.id === currentId) ?? null;
        if (currentPlayer?.isBot && typeof currentId === 'number') {
            if (!hasAvailableActions(currentId)) {
                return null;
            }
            return currentId;
        }
        return null;
    }
    pendingSignature(pending) {
        if (!pending)
            return null;
        return JSON.stringify({
            type: typeof pending.type === 'string' ? pending.type : null,
            step: typeof pending.step === 'string' ? pending.step : null,
            playerId: typeof pending.playerId === 'number' ? pending.playerId : null,
            initiatorPlayerId: typeof pending.initiatorPlayerId === 'number'
                ? pending.initiatorPlayerId
                : null,
            targetPlayerId: typeof pending.targetPlayerId === 'number'
                ? pending.targetPlayerId
                : null,
        });
    }
    buildSystemTimerKey(roomId, gameType, suffix) {
        return `${this.buildKey(roomId, gameType)}:${suffix}`;
    }
    async applySystemActions(roomId, gameType, actions) {
        await this.enqueueMutation(this.buildKey(roomId, gameType), async () => {
            const current = await this.normalizeBotThinking(roomId, gameType, await this.getInternalState(roomId, gameType));
            if ((current.status || '').toLowerCase() === 'finished') {
                return;
            }
            const handler = this.registry.getHandler(gameType);
            if (!handler) {
                return;
            }
            const meta = this.toMetadata(current);
            const fallbackActorId = typeof meta['ownerPlayerId'] === 'number'
                ? meta['ownerPlayerId']
                : (current.turn?.currentPlayerId ?? current.players?.[0]?.id ?? null);
            const sanitizedActions = (Array.isArray(actions) ? actions : []).map((action) => ({
                ...action,
                meta: {
                    ...(action?.meta ?? {}),
                    actor: 'system',
                    actorId: fallbackActorId,
                },
            }));
            const next = handler.applyActions(current, sanitizedActions);
            const botTurn = this.isBotTurn(next);
            let marked = await this.markBotThinking(roomId, gameType, next, botTurn);
            marked = this.normalizeWinnerMetadata(marked);
            marked = this.forceFinishedIfWinnerDetected(marked);
            marked = this.appendBoardArrivalAnnouncements(gameType, handler, current, marked);
            marked = this.appendSkipTurnAnnouncements(marked);
            await this.store.set(roomId, gameType, marked, { asyncPersist: true });
            await this.scheduleBotTurn(roomId, gameType, marked);
            this.broadcaster?.(gameType, roomId, marked);
        });
    }
    async scheduleBotTurn(roomId, gameType, state) {
        const key = this.buildKey(roomId, gameType);
        const systemKey = this.buildSystemTimerKey(roomId, gameType, 'system');
        const status = (state.status || '').toLowerCase();
        if (status === 'finished' ||
            status === 'setup' ||
            status === 'open' ||
            status === 'pending' ||
            status === 'preparing') {
            this.botScheduler.clear(key);
            this.botScheduler.clear(systemKey);
            return;
        }
        if (gameType === 'lama') {
            const lamaMeta = this.toMetadata(state);
            const step = this.normalizeMetadataString(lamaMeta['step']);
            if (step === 'round_pause') {
                const untilMs = this.parseMetadataNumber(lamaMeta['roundPauseUntilMs']);
                const delayMs = untilMs != null
                    ? Math.max(0, untilMs - GameEngineService_1.nowMs())
                    : 0;
                this.botScheduler.clear(key);
                this.botScheduler.schedule({
                    key: systemKey,
                    delayMs,
                    roomId,
                    gameType,
                    run: async () => {
                        const latest = (await this.store.get(roomId, gameType)) ?? null;
                        if (!latest)
                            return;
                        const latestMeta = this.toMetadata(latest);
                        const latestStep = this.normalizeMetadataString(latestMeta['step']);
                        if (latestStep !== 'round_pause')
                            return;
                        const latestUntilMs = this.parseMetadataNumber(latestMeta['roundPauseUntilMs']);
                        if (typeof untilMs === 'number' &&
                            latestUntilMs !== null &&
                            latestUntilMs !== untilMs) {
                            return;
                        }
                        await this.applySystemActions(roomId, gameType, [
                            { type: 'lama_resume_round', payload: {} },
                        ]);
                    },
                    onStale: () => this.cleanupRoom(roomId, gameType),
                });
                return;
            }
            this.botScheduler.clear(systemKey);
        }
        if (gameType === 'arche-de-mnemosyne') {
            const mnemoMeta = this.toMetadata(state);
            const configMeta = this.getMetadataObject(mnemoMeta, 'config');
            const useTimer = configMeta?.['useTimer'] === true;
            const untilMs = this.parseMetadataNumber(mnemoMeta['quizDeadlineAtMs']);
            const questionMeta = this.getMetadataObject(mnemoMeta, 'currentQuestion');
            const questionId = questionMeta && typeof questionMeta['id'] === 'string'
                ? questionMeta['id']
                : null;
            const interUntilMs = this.parseMetadataNumber(mnemoMeta['interQuestionUntilMs']);
            if (interUntilMs != null && !questionId) {
                const delayMs = Math.max(0, interUntilMs - GameEngineService_1.nowMs());
                this.botScheduler.clear(systemKey);
                this.botScheduler.schedule({
                    key: systemKey,
                    delayMs,
                    roomId,
                    gameType,
                    run: async () => {
                        const latest = (await this.store.get(roomId, gameType)) ?? null;
                        if (!latest)
                            return;
                        const latestMeta = this.toMetadata(latest);
                        const latestQuestionMeta = this.getMetadataObject(latestMeta, 'currentQuestion');
                        if (latestQuestionMeta &&
                            typeof latestQuestionMeta['id'] === 'string') {
                            return;
                        }
                        const latestInterUntilMs = this.parseMetadataNumber(latestMeta['interQuestionUntilMs']);
                        if (latestInterUntilMs === null)
                            return;
                        if (latestInterUntilMs !== interUntilMs)
                            return;
                        await this.applySystemActions(roomId, gameType, [
                            { type: 'mnemo_timeout', payload: {} },
                        ]);
                    },
                    onStale: () => this.cleanupRoom(roomId, gameType),
                });
            }
            else if (useTimer && untilMs != null && questionId) {
                const delayMs = Math.max(0, untilMs - GameEngineService_1.nowMs());
                this.botScheduler.clear(systemKey);
                this.botScheduler.schedule({
                    key: systemKey,
                    delayMs,
                    roomId,
                    gameType,
                    run: async () => {
                        const latest = (await this.store.get(roomId, gameType)) ?? null;
                        if (!latest)
                            return;
                        const latestMeta = this.toMetadata(latest);
                        const latestConfigMeta = this.getMetadataObject(latestMeta, 'config');
                        if (latestConfigMeta?.['useTimer'] !== true)
                            return;
                        const latestQuestionMeta = this.getMetadataObject(latestMeta, 'currentQuestion');
                        if (!latestQuestionMeta ||
                            typeof latestQuestionMeta['id'] !== 'string') {
                            return;
                        }
                        if (latestQuestionMeta['id'] !== questionId)
                            return;
                        const latestDeadline = this.parseMetadataNumber(latestMeta['quizDeadlineAtMs']);
                        if (latestDeadline !== null && latestDeadline !== untilMs) {
                            return;
                        }
                        await this.applySystemActions(roomId, gameType, [
                            { type: 'mnemo_timeout', payload: {} },
                        ]);
                    },
                    onStale: () => this.cleanupRoom(roomId, gameType),
                });
            }
            else {
                this.botScheduler.clear(systemKey);
            }
        }
        const handler = this.registry.getHandler(gameType);
        const botActorId = this.getBotActorIdForState(state, handler);
        const botPlayer = botActorId != null
            ? (state.players?.find((p) => p.id === botActorId) ?? null)
            : null;
        if (!botPlayer?.isBot) {
            this.botScheduler.clear(key);
            return;
        }
        if (this.botScheduler.has(key))
            return;
        const baseDelayMs = this.botSettings.getBotTurnDelayMs();
        const initialDelayMs = this.botSettings.getBotStartDelayMs();
        const drawDelayMs = this.botSettings.getBotDrawDelayMs();
        const meta = this.toMetadata(state);
        const immediateStart = meta['botImmediateStartPending'] === true;
        const pending = state.pending ?? null;
        const pendingType = typeof pending?.type === 'string'
            ? pending.type.trim().toLowerCase()
            : '';
        const pendingPlayerIdRaw = pending?.playerId;
        const pendingPlayerId = typeof pendingPlayerIdRaw === 'number'
            ? pendingPlayerIdRaw
            : Number(pendingPlayerIdRaw);
        const fastPendingBotAction = Number.isFinite(pendingPlayerId) &&
            pendingPlayerId === botActorId &&
            (pendingType === 'draw' ||
                pendingType === 'pick_pawn' ||
                pendingType === 'choose_target');
        const isQuizPending = gameType === 'arche-de-mnemosyne' && pending?.type === 'quiz';
        const configMeta = this.getMetadataObject(meta, 'config');
        const quizTimerSeconds = isQuizPending &&
            configMeta &&
            typeof configMeta['timerSeconds'] === 'number'
            ? Number(configMeta['timerSeconds'])
            : null;
        const quizTimerMs = quizTimerSeconds != null && Number.isFinite(quizTimerSeconds)
            ? Math.max(1, quizTimerSeconds) * 1000
            : null;
        let delayMs = baseDelayMs;
        if (immediateStart) {
            delayMs = initialDelayMs;
        }
        else if (pendingType === 'draw') {
            delayMs = drawDelayMs;
        }
        else if (fastPendingBotAction) {
            delayMs = 0;
        }
        if (isQuizPending && quizTimerMs != null) {
            delayMs = Math.min(delayMs, quizTimerMs);
        }
        const stateForSchedule = immediateStart
            ? {
                ...state,
                metadata: { ...meta, botImmediateStartPending: false },
            }
            : state;
        const thinking = await this.markBotThinking(roomId, gameType, stateForSchedule, true);
        this.broadcaster?.(gameType, roomId, thinking);
        this.gameLogger.debug('Bot turn scheduled', {
            roomId,
            gameType,
            turnIndex: thinking.turnIndex,
            playerId: botActorId ?? undefined,
            action: {
                status: thinking.status,
                delayMs,
            },
        });
        const expectedTurnIndex = thinking.turnIndex ?? null;
        const expectedCurrentPlayerId = thinking.turn?.currentPlayerId ?? null;
        const expectedBotActorId = botActorId ?? null;
        const expectedPendingSig = this.pendingSignature(thinking.pending);
        this.botScheduler.schedule({
            key,
            delayMs,
            roomId,
            gameType,
            run: async () => {
                const latest = (await this.store.get(roomId, gameType)) ?? null;
                if (!latest) {
                    return;
                }
                if ((latest.status || '').toLowerCase() === 'finished') {
                    return;
                }
                const latestTurnIndex = latest.turnIndex ?? null;
                const latestCurrentPlayerId = latest.turn?.currentPlayerId ?? null;
                const latestBotActorId = this.getBotActorIdForState(latest, handler);
                const latestPendingSig = this.pendingSignature(latest.pending);
                if (latestTurnIndex !== expectedTurnIndex ||
                    latestCurrentPlayerId !== expectedCurrentPlayerId ||
                    latestBotActorId !== expectedBotActorId ||
                    latestPendingSig !== expectedPendingSig) {
                    this.gameLogger.debug('Bot turn skipped (stale)', {
                        roomId,
                        gameType,
                        action: {
                            expectedTurnIndex,
                            latestTurnIndex,
                            expectedCurrentPlayerId,
                            latestCurrentPlayerId,
                            expectedBotActorId,
                            latestBotActorId,
                        },
                    });
                    return;
                }
                await this.playBotTurn(roomId, gameType);
            },
            onStale: () => this.cleanupRoom(roomId, gameType),
        });
    }
    async checkAccess(roomId, userId, ownerOnly = false) {
        let payload;
        try {
            payload = await this.rooms.getRoomPayload(roomId);
        }
        catch (err) {
            if (this.isRoomNotFound(err)) {
                throw new common_1.NotFoundException('Table introuvable');
            }
            throw err;
        }
        const players = Array.isArray(payload?.room?.players)
            ? payload.room.players
            : [];
        const isParticipant = players.some((p) => p?.id === userId);
        const isOwner = payload?.room?.owner?.id === userId;
        if (ownerOnly && !isOwner) {
            throw new common_1.UnauthorizedException('Seul le propriétaire peut effectuer cette action');
        }
        if (!ownerOnly && !isParticipant && !isOwner) {
            throw new common_1.UnauthorizedException('Accès non autorisé à cette table');
        }
    }
    async checkReadAccess(roomId, userId) {
        let payload;
        try {
            payload = await this.rooms.getRoomPayload(roomId);
        }
        catch (err) {
            if (this.isRoomNotFound(err)) {
                throw new common_1.NotFoundException('Table introuvable');
            }
            throw err;
        }
        const players = Array.isArray(payload?.room?.players)
            ? payload.room.players
            : [];
        const isParticipant = players.some((p) => p?.id === userId);
        const isOwner = payload?.room?.owner?.id === userId;
        if (payload?.room?.isPrivate && !isParticipant && !isOwner) {
            throw new common_1.UnauthorizedException('Accès non autorisé à cette table');
        }
    }
    async checkPlayAccess(roomId, userId) {
        let payload;
        try {
            payload = await this.rooms.getRoomPayload(roomId);
        }
        catch (err) {
            if (this.isRoomNotFound(err)) {
                throw new common_1.NotFoundException('Table introuvable');
            }
            throw err;
        }
        const players = Array.isArray(payload?.room?.players)
            ? payload.room.players
            : [];
        const isParticipant = players.some((p) => p?.id === userId);
        if (!isParticipant) {
            throw new common_1.UnauthorizedException('Mode spectateur : action de jeu interdite');
        }
    }
    buildInitialState(payload, gameType) {
        const baseState = this.core.buildBaseState(payload, gameType);
        const status = String(baseState.status ?? '')
            .toLowerCase()
            .trim();
        if (status !== 'started') {
            return baseState;
        }
        const handler = this.registry.getHandler(gameType);
        if (handler) {
            const hydrated = handler.hydrateInitialState(baseState);
            const randomizedStarter = this.ensureRandomStarterAtGameStart(baseState, hydrated);
            const withMeta = {
                ...randomizedStarter,
                metadata: {
                    ...(randomizedStarter.metadata ?? {}),
                    botImmediateStartPending: true,
                },
            };
            return this.appendFirstTurnAnnouncement(withMeta);
        }
        const logged = this.core.appendLog(baseState, `Type de jeu non spécialisé: ${gameType}`);
        const withMeta = {
            ...logged,
            metadata: {
                ...(logged.metadata ?? {}),
                botImmediateStartPending: true,
            },
        };
        return this.appendFirstTurnAnnouncement(withMeta);
    }
    ensureRandomStarterAtGameStart(baseState, state) {
        const status = String(state.status ?? '')
            .toLowerCase()
            .trim();
        if (status !== 'started')
            return state;
        const players = Array.isArray(state.players) ? state.players : [];
        if (!players.length)
            return state;
        const pending = state.pending ?? null;
        const pendingPlayerId = typeof pending?.playerId === 'number' ? pending.playerId : null;
        const blockingPending = pending?.blocking === true;
        if (blockingPending && pendingPlayerId != null) {
            return state;
        }
        const starterMeta = this.toMetadata(state);
        if (starterMeta['starterChosenAfterPawnSelection'] === true) {
            return state;
        }
        const baseStarterId = baseState.turn?.currentPlayerId ?? null;
        const starterId = typeof baseStarterId === 'number' &&
            players.some((p) => p?.id === baseStarterId)
            ? baseStarterId
            : (players[0]?.id ?? null);
        if (typeof starterId !== 'number')
            return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        const starterIndex = Math.max(0, players.findIndex((p) => p?.id === starterId));
        const currentTurnIndex = typeof state.turnIndex === 'number' ? state.turnIndex : 0;
        if (currentId === starterId && currentTurnIndex === starterIndex) {
            return state;
        }
        return {
            ...state,
            turnIndex: starterIndex,
            turn: {
                ...(state.turn ?? { direction: 1 }),
                currentPlayerId: starterId,
            },
        };
    }
    appendFirstTurnAnnouncement(state) {
        const status = String(state.status ?? '')
            .toLowerCase()
            .trim();
        if (status !== 'started') {
            return state;
        }
        const currentPlayerId = state.turn?.currentPlayerId ?? null;
        if (typeof currentPlayerId !== 'number' ||
            !Number.isFinite(currentPlayerId)) {
            return state;
        }
        const pending = state.pending ?? null;
        const pendingType = String(pending?.type ?? '')
            .trim()
            .toLowerCase();
        if (pendingType === 'pick_pawn') {
            return state;
        }
        const log = Array.isArray(state.log) ? state.log : [];
        const recentMessages = log.slice(-3).map((entry) => String(entry?.message ?? '')
            .trim()
            .toLowerCase());
        if (recentMessages.some((m) => m.startsWith("c'est au tour de "))) {
            return state;
        }
        const players = Array.isArray(state.players) ? state.players : [];
        const name = this.normalizeUsernameForLog(players.find((p) => p?.id === currentPlayerId)?.username) || `Joueur ${currentPlayerId}`;
        return this.core.appendLog(state, `C'est au tour de ${name}.`);
    }
    buildKey(roomId, gameType) {
        return this.store.buildKey(roomId, gameType);
    }
    isWithinFinishedGraceWindow(state) {
        if (!state)
            return false;
        if (String(state.status ?? '').toLowerCase() !== 'finished') {
            return false;
        }
        const metadata = this.toMetadata(state);
        const finishedAt = this.normalizeMetadataString(metadata['finishedAt']);
        if (!finishedAt) {
            return false;
        }
        const finishedAtMs = Date.parse(finishedAt);
        if (!Number.isFinite(finishedAtMs)) {
            return false;
        }
        const ageMs = GameEngineService_1.nowMs() - finishedAtMs;
        return ageMs >= 0 && ageMs < GameEngineService_1.FINISHED_STATE_GRACE_MS;
    }
    async scheduleFinishedRoomReset(roomId, gameType, state) {
        await Promise.resolve();
        if (String(state?.status ?? '').toLowerCase() !== 'finished') {
            return;
        }
        const systemKey = this.buildSystemTimerKey(roomId, gameType, 'finished-reset');
        if (this.botScheduler.has(systemKey)) {
            return;
        }
        const expectedFinishedAt = this.normalizeMetadataString(this.toMetadata(state)['finishedAt']);
        this.botScheduler.schedule({
            key: systemKey,
            delayMs: GameEngineService_1.FINISHED_STATE_GRACE_MS,
            roomId,
            gameType,
            run: async () => {
                await this.enqueueMutation(this.buildKey(roomId, gameType), async () => {
                    const latest = (await this.store.get(roomId, gameType)) ?? null;
                    if (!latest)
                        return;
                    if (String(latest.status ?? '').toLowerCase() !== 'finished') {
                        return;
                    }
                    const latestFinishedAt = this.normalizeMetadataString(this.toMetadata(latest)['finishedAt']);
                    if (expectedFinishedAt &&
                        latestFinishedAt &&
                        latestFinishedAt !== expectedFinishedAt) {
                        return;
                    }
                    try {
                        await this.rooms.resetRoomSystem(roomId);
                    }
                    catch (err) {
                        this.gameLogger.error('Auto-reset room after game finished failed', err instanceof Error ? err : undefined, { roomId, gameType });
                    }
                    try {
                        await this.store.delete(roomId, gameType);
                    }
                    catch (err) {
                        this.gameLogger.error('Auto-reset game state after finish failed', err instanceof Error ? err : undefined, { roomId, gameType });
                    }
                    try {
                        await this.rooms.notifyRoomStateUpdated(roomId);
                    }
                    catch {
                    }
                    try {
                        const fresh = await this.getInternalState(roomId, gameType);
                        this.broadcaster?.(gameType, roomId, fresh);
                    }
                    catch (err) {
                        this.gameLogger.error('Broadcast fresh state after finish failed', err instanceof Error ? err : undefined, { roomId, gameType });
                    }
                    this.botScheduler.clear(this.buildKey(roomId, gameType));
                });
            },
            onStale: () => this.cleanupRoom(roomId, gameType),
        });
    }
    async markBotThinking(roomId, gameType, state, botTurn) {
        const handler = this.registry.getHandler(gameType);
        const actionableBotId = this.getBotActorIdForState(state, handler);
        const isBot = actionableBotId != null || (botTurn === true && !handler);
        const now = GameEngineService_1.nowMs();
        const marked = {
            ...this.store.markBotThinking(state, isBot),
            botThinkingSince: isBot ? now : null,
        };
        await this.store.set(roomId, gameType, marked, { asyncPersist: true });
        return marked;
    }
    async normalizeBotThinking(roomId, gameType, state) {
        const since = typeof state.botThinkingSince === 'number'
            ? state.botThinkingSince
            : null;
        if (!state.botThinking) {
            return state;
        }
        if (since == null) {
            const patched = {
                ...state,
                botThinkingSince: GameEngineService_1.nowMs(),
            };
            await this.store.set(roomId, gameType, patched, { asyncPersist: true });
            return patched;
        }
        const age = GameEngineService_1.nowMs() - since;
        if (age <= GameEngineService_1.BOT_THINKING_TTL_MS) {
            return state;
        }
        this.gameLogger.warn('Bot thinking state expired', {
            roomId,
            gameType,
            turnIndex: state.turnIndex,
            action: {
                ageMs: age,
            },
        });
        const cleared = {
            ...state,
            botThinking: false,
            botThinkingSince: null,
        };
        await this.store.set(roomId, gameType, cleared, { asyncPersist: true });
        return cleared;
    }
    async validateActions(state, handler, actions, actorId) {
        const ctx = this.toMetadata(state);
        const ctxGameType = typeof ctx['gameType'] === 'string' ? ctx['gameType'] : null;
        const ctxRoomId = this.parseMetadataNumber(ctx['roomId']);
        const list = Array.isArray(actions) ? actions : [];
        if (list.length === 0) {
            return [];
        }
        if (list.length > GameEngineService_1.MAX_ACTIONS_PER_MESSAGE) {
            throw new common_1.BadRequestException("Trop d'actions dans un seul message");
        }
        let validatedDtos = [];
        try {
            validatedDtos = await (0, validated_action_dto_1.validateActions)(list, {
                gameType: ctxGameType,
                roomId: ctxRoomId,
                actorId,
            });
        }
        catch (error) {
            if (error instanceof game_errors_1.PayloadValidationError) {
                this.gameLogger.logValidationFailure(error.message, error.validationErrors, {
                    gameType: ctxGameType ?? undefined,
                    roomId: ctxRoomId ?? undefined,
                    playerId: actorId ?? undefined,
                });
                throw new common_1.BadRequestException(error.message);
            }
            throw error;
        }
        const sanitized = validatedDtos.map((dto) => (0, validated_action_dto_1.sanitizeAction)(dto));
        let allowedTypes = null;
        if (handler?.getAvailableActions && actorId != null) {
            try {
                const available = handler.getAvailableActions(state, actorId) ?? [];
                const availableList = Array.isArray(available) ? available : [];
                allowedTypes = new Set(availableList.map((entry) => {
                    if (!entry || typeof entry !== 'object')
                        return '';
                    const entryType = typeof entry.type === 'string' ? entry.type : '';
                    return this.normalizeActionType(entryType);
                }));
            }
            catch (err) {
                this.gameLogger.error('Error getting available actions', err instanceof Error ? err : undefined, {
                    gameType: ctxGameType ?? undefined,
                    roomId: ctxRoomId ?? undefined,
                    playerId: actorId ?? undefined,
                });
                allowedTypes = null;
            }
        }
        let totalBytes = 0;
        const out = [];
        for (const action of sanitized) {
            const type = action.type.toLowerCase();
            if (type.length > GameEngineService_1.MAX_ACTION_TYPE_LENGTH) {
                throw new common_1.BadRequestException('Action invalide : type trop long');
            }
            if (allowedTypes && !allowedTypes.has(type)) {
                if (this.shouldSilentlyIgnoreUnavailableAction(type, action, state, actorId ?? null)) {
                    continue;
                }
                throw new common_1.BadRequestException(`Action inconnue ou indisponible: ${type}`);
            }
            let payloadBytes = 0;
            const payload = action.payload ?? null;
            if (payload != null) {
                try {
                    payloadBytes = Buffer.byteLength(JSON.stringify(payload), 'utf8');
                }
                catch {
                    throw new common_1.BadRequestException('Action invalide : payload non sérialisable');
                }
            }
            if (payloadBytes > GameEngineService_1.MAX_ACTION_PAYLOAD_BYTES) {
                throw new common_1.BadRequestException('Action invalide : payload trop volumineux');
            }
            totalBytes += payloadBytes;
            if (totalBytes > GameEngineService_1.MAX_MESSAGE_PAYLOAD_BYTES) {
                throw new common_1.BadRequestException('Message invalide : payload total trop volumineux');
            }
            let normalized = { ...action, type };
            if (handler?.validateAction) {
                try {
                    normalized = handler.validateAction(state, normalized, actorId ?? null);
                }
                catch (err) {
                    const message = err instanceof Error ? err.message : String(err ?? '');
                    if (this.isOutOfTurnMessage(message)) {
                        continue;
                    }
                    this.gameLogger.logValidationFailure(`Game-specific validation failed for action: ${type}`, [{ actionType: type, error: message }], {
                        gameType: ctxGameType ?? undefined,
                        roomId: ctxRoomId ?? undefined,
                        playerId: actorId ?? undefined,
                        action: { type },
                    });
                    throw new common_1.BadRequestException(message || `Action invalide: ${type}`);
                }
            }
            out.push(normalized);
        }
        return out;
    }
    shouldSilentlyIgnoreUnavailableAction(type, _action, state, actorId) {
        if (type === 'draw') {
            return true;
        }
        return this.isOutOfTurn(state, actorId);
    }
    isOutOfTurn(state, actorId) {
        if (actorId == null || !Number.isFinite(actorId))
            return false;
        const currentPlayerId = state?.turn?.currentPlayerId;
        if (typeof currentPlayerId !== 'number' ||
            !Number.isFinite(currentPlayerId)) {
            return false;
        }
        return actorId !== currentPlayerId;
    }
    isOutOfTurnMessage(message) {
        const normalized = String(message ?? '')
            .trim()
            .toLowerCase();
        if (!normalized)
            return false;
        return (normalized.includes('pas votre tour') ||
            normalized.includes("n'est pas votre tour") ||
            normalized.includes('attendez votre tour') ||
            normalized.includes('tour en cours'));
    }
    exposeState(state, gameType) {
        const label = this.turnLabel.compute(state, gameType);
        const handler = this.registry.getHandler(gameType);
        const exposed = handler?.exposeState
            ? handler.exposeState(state)
            : state;
        const withLabel = this.attachTurnLabel(exposed, label);
        const withDescriptors = this.attachUiDescriptors(this.gridRender.attachGridRenderDescriptors(this.attachCurrentPlayerView(withLabel)));
        return (0, mojibake_1.fixMojibakeDeep)(this.stripBoardAndGridIfNotStarted(withDescriptors));
    }
    stripBoardAndGridIfNotStarted(state) {
        const status = String(state?.status ?? '')
            .toLowerCase()
            .trim();
        if (status === 'started')
            return state;
        const extras = GameEngineService_1.extractExtras(state);
        const nextExtras = { ...extras };
        if (nextExtras.grid !== undefined) {
            delete nextExtras.grid;
        }
        const out = {
            ...state,
            actions: [],
            pending: null,
            extras: nextExtras,
        };
        if (out.board !== undefined) {
            delete out.board;
        }
        return out;
    }
    attachTurnLabel(state, label) {
        if (!label)
            return state;
        const current = state.turn ?? null;
        if (!current) {
            return { ...state, turn: { currentPlayerId: null, direction: 1, label } };
        }
        return { ...state, turn: { ...current, label } };
    }
    attachCurrentPlayerView(state) {
        const currentPlayerId = state.turn?.currentPlayerId ?? null;
        if (currentPlayerId === null)
            return state;
        const extras = GameEngineService_1.extractExtras(state);
        if (extras['currentPlayerView'] !== undefined)
            return state;
        const players = Array.isArray(state.players) ? state.players : [];
        const currentPlayer = players.find((p) => p?.id === currentPlayerId);
        if (!currentPlayer)
            return state;
        const currentPlayerView = {
            id: currentPlayer.id,
            username: currentPlayer.username ?? `Joueur ${currentPlayer.id}`,
        };
        return {
            ...state,
            extras: {
                ...extras,
                currentPlayerView,
            },
        };
    }
    appendBoardArrivalAnnouncements(_gameType, handler, previous, next) {
        try {
            if (!handler?.shouldAnnounceBoardArrivals?.()) {
                return next;
            }
            if (String(next.status ?? '')
                .toLowerCase()
                .trim() !== 'started') {
                return next;
            }
            const prevMeta = this.toMetadata(previous);
            const nextMeta = this.toMetadata(next);
            const tiles = Array.isArray(nextMeta['tiles'])
                ? nextMeta['tiles']
                : [];
            const prevPositions = this.getMetadataObject(prevMeta, 'positions') ??
                {};
            const nextPositions = this.getMetadataObject(nextMeta, 'positions') ??
                {};
            if (tiles.length === 0) {
                return next;
            }
            const players = Array.isArray(next.players) ? next.players : [];
            const changed = players
                .map((p) => {
                if (!p || typeof p.id !== 'number')
                    return null;
                const username = this.normalizeUsernameForLog(p.username) || `joueur ${p.id}`;
                const prevRaw = prevPositions[String(p.id)];
                const nextRaw = nextPositions[String(p.id)];
                const prevPos = typeof prevRaw === 'number' ? prevRaw : Number(prevRaw);
                const nextPos = typeof nextRaw === 'number' ? nextRaw : Number(nextRaw);
                return {
                    id: p.id,
                    username,
                    prevPos: Number.isFinite(prevPos) ? Math.trunc(prevPos) : null,
                    nextPos: Number.isFinite(nextPos) ? Math.trunc(nextPos) : null,
                };
            })
                .filter((p) => p != null &&
                p.nextPos != null &&
                p.prevPos != null &&
                p.nextPos !== p.prevPos)
                .sort((a, b) => a.id - b.id);
            if (changed.length === 0) {
                return next;
            }
            let out = next;
            for (const p of changed) {
                const idx = p.nextPos;
                if (idx < 0 || idx >= tiles.length) {
                    continue;
                }
                const tile = tiles[idx] ?? {};
                const labelRaw = this.normalizeMetadataString(tile['label']);
                const titleRaw = this.normalizeMetadataString(tile['title'] ?? tile['name']);
                const descriptionRaw = this.normalizeMetadataString(tile['description']);
                const caseNumber = idx + 1;
                const label = labelRaw || titleRaw ? labelRaw || titleRaw : '';
                const desc = descriptionRaw ? ` ${descriptionRaw}` : '';
                const name = p.username || `joueur ${p.id}`;
                const recentMsgs = (() => {
                    const log = Array.isArray(out.log) ? out.log : [];
                    const msgs = [];
                    for (let i = log.length - 1; i >= 0 && msgs.length < 4; i -= 1) {
                        const entry = log[i];
                        const msg = entry?.message;
                        if (typeof msg === 'string' && msg.trim().length > 0) {
                            msgs.push(String(msg).trim());
                        }
                    }
                    return msgs;
                })();
                const needleByNumber = `arrive sur case ${caseNumber}`.toLowerCase();
                const needleByLabel = label ? `arrive sur ${label}`.toLowerCase() : '';
                const needleByPlacement = `en case ${caseNumber}`.toLowerCase();
                const hasRecentArrival = recentMsgs.some((m) => {
                    const lower = m.toLowerCase();
                    return (lower.includes(needleByNumber) ||
                        (needleByLabel && lower.includes(needleByLabel)) ||
                        lower.includes(needleByPlacement));
                });
                if (hasRecentArrival) {
                    continue;
                }
                if (label && /^case\\s+\\d+/i.test(label)) {
                    out = this.core.appendLog(out, `${name} arrive sur ${label}.${desc}`.trim());
                }
                else {
                    const suffix = label ? ` - ${label}` : '';
                    out = this.core.appendLog(out, `${name} arrive sur case ${caseNumber}${suffix}.${desc}`.trim());
                }
            }
            return out;
        }
        catch {
            return next;
        }
    }
    appendSkipTurnAnnouncements(state) {
        try {
            const meta = this.toMetadata(state);
            const turnFlow = this.getMetadataObject(meta, 'turnFlow') ??
                {};
            const skippedRaw = turnFlow['skipped'];
            const skipped = Array.isArray(skippedRaw)
                ? skippedRaw
                : [];
            if (!skipped.length) {
                return state;
            }
            let out = state;
            for (const entry of skipped) {
                if (!entry || typeof entry !== 'object')
                    continue;
                const data = entry;
                const id = typeof data['id'] === 'number' ? data['id'] : null;
                if (id == null)
                    continue;
                const remaining = typeof data['remainingAfter'] === 'number'
                    ? data['remainingAfter']
                    : 0;
                const player = out.players?.find((p) => p?.id === id) ?? null;
                const name = this.normalizeUsernameForLog(player?.username);
                const who = name ? name : `joueur ${id}`;
                const suffix = remaining > 0 ? ` (${remaining} restant)` : '';
                out = this.core.appendLog(out, `${who} passe son tour${suffix}.`);
            }
            const cleanedTurnFlow = { ...turnFlow, skipped: [] };
            return {
                ...out,
                metadata: {
                    ...meta,
                    turnFlow: cleanedTurnFlow,
                },
            };
        }
        catch {
            return state;
        }
    }
    attachViewerContext(state, userId) {
        const extras = GameEngineService_1.extractExtras(state);
        if (extras['viewerPlayerId'] !== undefined)
            return state;
        const players = Array.isArray(state.players) ? state.players : [];
        const viewerPlayer = players.find((p) => p?.id === userId) ?? null;
        const viewerPlayerId = viewerPlayer ? viewerPlayer.id : null;
        const viewerUsername = viewerPlayer && typeof viewerPlayer.username === 'string'
            ? viewerPlayer.username
            : viewerPlayer
                ? `Joueur ${viewerPlayer.id}`
                : null;
        return {
            ...state,
            extras: {
                ...extras,
                viewerPlayerId,
                viewerUsername,
            },
        };
    }
    attachUiDescriptors(state) {
        const turnLabel = String(state.turn?.label ?? '').trim();
        if (!turnLabel)
            return state;
        const extrasNow = GameEngineService_1.extractExtras(state);
        const uiExistingNow = GameEngineService_1.extractUi(extrasNow);
        const uiNow = uiExistingNow ? { ...uiExistingNow } : {};
        const panelsExistingNow = GameEngineService_1.extractPanels(uiExistingNow);
        const panelsNow = panelsExistingNow ? { ...panelsExistingNow } : {};
        const existingTurn = panelsNow['turn'];
        const existingTurnMessage = existingTurn && typeof existingTurn['message'] === 'string'
            ? existingTurn['message']
            : null;
        const hasTurnMessage = typeof existingTurnMessage === 'string' &&
            existingTurnMessage.trim().length > 0;
        if (!hasTurnMessage) {
            panelsNow['turn'] = {
                title: 'Tour',
                message: turnLabel.endsWith('.') ? turnLabel : `${turnLabel}.`,
            };
        }
        uiNow['panels'] = panelsNow;
        const stateWithTurnPanel = {
            ...state,
            extras: {
                ...extrasNow,
                ui: uiNow,
            },
        };
        const extrasAfter = GameEngineService_1.extractExtras(stateWithTurnPanel);
        const uiExisting = GameEngineService_1.extractUi(extrasAfter);
        const ui = uiExisting ? { ...uiExisting } : {};
        const panelsExisting = GameEngineService_1.extractPanels(uiExisting);
        const panels = panelsExisting ? { ...panelsExisting } : {};
        const currentPlayerView = extrasAfter['currentPlayerView'] ?? null;
        const metadata = stateWithTurnPanel.metadata &&
            typeof stateWithTurnPanel.metadata === 'object'
            ? stateWithTurnPanel.metadata
            : {};
        const upsertPanel = (id, title, message) => {
            if (!id || !title || !message)
                return;
            const existing = panels[id];
            const existingMessage = existing && typeof existing['message'] === 'string'
                ? existing['message']
                : null;
            const hasMessage = typeof existingMessage === 'string' &&
                existingMessage.trim().length > 0;
            if (hasMessage)
                return;
            panels[id] = { title, message };
        };
        const buildListMessage = (title, itemsRaw) => {
            const items = Array.isArray(itemsRaw)
                ? itemsRaw.map((x) => this.normalizeMetadataString(x)).filter((x) => x)
                : [];
            if (items.length === 0)
                return `${title}: (vide)`;
            const max = 12;
            const shown = items.length > max ? items.slice(0, max) : items;
            const body = shown.join(', ');
            return items.length > max
                ? `${title}: ${body}, ... (+${items.length - max})`
                : `${title}: ${body}`;
        };
        const normalizeSentence = (text) => {
            const t = this.normalizeMetadataString(text);
            if (!t)
                return '';
            return t.endsWith('.') ? t : `${t}.`;
        };
        const buildJoinedLinesMessage = (title, linesRaw) => {
            const lines = Array.isArray(linesRaw)
                ? linesRaw.map(normalizeSentence).filter((x) => x)
                : [];
            if (lines.length === 0)
                return `${title}: inconnue.`;
            return lines.join(' ');
        };
        if (currentPlayerView && typeof currentPlayerView === 'object') {
            upsertPanel('shopping', 'Shopping list', buildListMessage('Shopping list', currentPlayerView.shoppingList));
            upsertPanel('basket', 'Panier', buildListMessage('Panier', currentPlayerView.basket));
            upsertPanel('inventory', 'Inventaire', buildListMessage('Inventaire', currentPlayerView.inventory));
            upsertPanel('stable', 'Écurie', buildJoinedLinesMessage('Écurie', currentPlayerView.stable));
            upsertPanel('position', 'Position', buildJoinedLinesMessage('Position', currentPlayerView.position));
        }
        upsertPanel('score', 'Score', buildListMessage('Score', extrasAfter['score']));
        upsertPanel('hand', 'Main', buildListMessage('Main', extrasAfter['hand']));
        upsertPanel('books', 'Familles', buildListMessage('Familles', extrasAfter['books']));
        const pollution = typeof metadata['pollution'] === 'number' ? metadata['pollution'] : null;
        const maxPollution = typeof metadata['maxPollution'] === 'number'
            ? metadata['maxPollution']
            : null;
        if (pollution !== null || maxPollution !== null) {
            let message = 'Pollution: inconnue.';
            if (pollution !== null && maxPollution !== null)
                message = `Pollution: ${pollution}/${maxPollution}.`;
            else if (pollution !== null)
                message = `Pollution: ${pollution}.`;
            else if (maxPollution !== null)
                message = `Pollution max: ${maxPollution}.`;
            upsertPanel('pollution', 'Pollution', message);
        }
        ui['panels'] = panels;
        return {
            ...stateWithTurnPanel,
            extras: {
                ...extrasAfter,
                ui,
            },
        };
    }
    isRoomNotFound(err) {
        if (err instanceof common_1.NotFoundException)
            return true;
        const message = this.normalizeMetadataString(err instanceof Error ? err.message : err);
        return (message.includes('Room introuvable') ||
            message.includes('Table introuvable'));
    }
    cleanupRoom(roomId, gameType) {
        const key = this.buildKey(roomId, gameType);
        try {
            this.botScheduler.clear(key);
        }
        catch {
        }
        void this.store.delete(roomId, gameType);
        this.mutationQueue.delete(key);
    }
    static extractExtras(state) {
        if (!state) {
            return {};
        }
        const candidate = 'extras' in state ? state.extras : undefined;
        if (candidate &&
            typeof candidate === 'object' &&
            !Array.isArray(candidate)) {
            return candidate;
        }
        return {};
    }
    static extractUi(extras) {
        const uiRaw = extras['ui'];
        if (uiRaw && typeof uiRaw === 'object' && !Array.isArray(uiRaw)) {
            return uiRaw;
        }
        return null;
    }
    static extractPanels(ui) {
        if (!ui) {
            return null;
        }
        const panelsRaw = ui['panels'];
        if (panelsRaw &&
            typeof panelsRaw === 'object' &&
            !Array.isArray(panelsRaw)) {
            return panelsRaw;
        }
        return null;
    }
    static extractPanelMessage(panel) {
        if (!panel) {
            return '';
        }
        const message = panel['message'];
        return typeof message === 'string' ? message.trim() : '';
    }
};
exports.GameEngineService = GameEngineService;
exports.GameEngineService = GameEngineService = GameEngineService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [room_service_1.RoomService,
        game_core_service_1.GameCoreService,
        game_registry_service_1.GameRegistryService,
        turn_label_service_1.TurnLabelService,
        bot_runner_service_1.BotRunnerService,
        bot_scheduler_service_1.BotSchedulerService,
        bot_settings_service_1.BotSettingsService,
        grid_render_service_1.GridRenderService,
        game_engine_state_store_1.GameEngineStateStore,
        game_logger_service_1.GameLoggerService,
        game_stats_service_1.GameStatsService])
], GameEngineService);
//# sourceMappingURL=game-engine.service.js.map