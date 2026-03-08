"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _testing = require("@nestjs/testing");
const _gamepluginsmodule = require("../../engine/game-plugins.module");
const _gameregistrymodule = require("../../engine/game-registry.module");
const _gameregistryservice = require("../../engine/services/game-registry.service");
const _typeorm = require("@nestjs/typeorm");
const _nodefs = /*#__PURE__*/ _interop_require_wildcard(require("node:fs"));
const _nodepath = /*#__PURE__*/ _interop_require_wildcard(require("node:path"));
function _getRequireWildcardCache(nodeInterop) {
    if (typeof WeakMap !== "function") return null;
    var cacheBabelInterop = new WeakMap();
    var cacheNodeInterop = new WeakMap();
    return (_getRequireWildcardCache = function(nodeInterop) {
        return nodeInterop ? cacheNodeInterop : cacheBabelInterop;
    })(nodeInterop);
}
function _interop_require_wildcard(obj, nodeInterop) {
    if (!nodeInterop && obj && obj.__esModule) {
        return obj;
    }
    if (obj === null || typeof obj !== "object" && typeof obj !== "function") {
        return {
            default: obj
        };
    }
    var cache = _getRequireWildcardCache(nodeInterop);
    if (cache && cache.has(obj)) {
        return cache.get(obj);
    }
    var newObj = {
        __proto__: null
    };
    var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor;
    for(var key in obj){
        if (key !== "default" && Object.prototype.hasOwnProperty.call(obj, key)) {
            var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null;
            if (desc && (desc.get || desc.set)) {
                Object.defineProperty(newObj, key, desc);
            } else {
                newObj[key] = obj[key];
            }
        }
    }
    newObj.default = obj;
    if (cache) {
        cache.set(obj, newObj);
    }
    return newObj;
}
jest.mock('../../engine/services/game-registry.service', ()=>{
    let GameRegistryServiceMock = class GameRegistryServiceMock {
        register(handler) {
            this.handlers.set(handler.gameType, handler);
        }
        getHandler(gameType) {
            return this.handlers.get(gameType);
        }
        async listGames() {
            return Array.from(this.handlers.values()).map((handler)=>({
                    id: handler.gameType,
                    name: handler.displayName,
                    category: handler.category,
                    subcategory: handler.subcategory,
                    description: handler.description,
                    minPlayers: handler.minPlayers,
                    maxPlayers: handler.maxPlayers
                }));
        }
        invalidateCache() {}
        constructor(){
            this.handlers = new Map();
        }
    };
    return {
        GameRegistryService: GameRegistryServiceMock
    };
});
jest.mock('../../engine/game-registry.module', ()=>{
    const { Module } = jest.requireActual('@nestjs/common');
    const { GameRegistryService } = jest.requireMock('../../engine/services/game-registry.service');
    let GameRegistryModuleMock = class GameRegistryModuleMock {
    };
    Module({
        providers: [
            GameRegistryService
        ],
        exports: [
            GameRegistryService
        ]
    })(GameRegistryModuleMock);
    return {
        GameRegistryModule: GameRegistryModuleMock
    };
});
jest.setTimeout(120000);
process.env.GAME_MODULES_ROOT = _nodepath.resolve(process.cwd(), 'src', 'game', 'games');
function createBaseState(gameType, players = 4) {
    return {
        status: 'started',
        phase: 'playing',
        round: 1,
        turnIndex: 0,
        lastRoll: null,
        log: [],
        players: Array.from({
            length: players
        }, (_, i)=>({
                id: i + 1,
                username: `P${i + 1}`,
                isBot: i >= 2
            })),
        turn: {
            currentPlayerId: 1,
            direction: 1
        },
        metadata: {
            roomId: 1,
            roomOwnerId: 1,
            roomStartedAt: '2026-03-02T00:00:00.000Z',
            roomRunId: 1,
            gameType,
            rng: {
                seed: 123456,
                counter: 0
            }
        },
        pending: null,
        botThinking: false
    };
}
function asRecord(value) {
    return value != null && typeof value === 'object' ? value : {};
}
function asArray(value) {
    return Array.isArray(value) ? value : [];
}
function toNumberValue(value) {
    const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim().length > 0 ? Number(value) : NaN;
    return Number.isFinite(n) ? n : null;
}
function readBackendEnv() {
    try {
        const envPath = _nodepath.resolve(process.cwd(), '.env');
        if (!_nodefs.existsSync(envPath)) return {};
        const raw = _nodefs.readFileSync(envPath, 'utf8');
        const out = {};
        for (const line of raw.split(/\r?\n/)){
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const idx = trimmed.indexOf('=');
            if (idx <= 0) continue;
            out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
        }
        return out;
    } catch  {
        return {};
    }
}
function toAction(candidate) {
    if (!candidate || typeof candidate !== 'object') return null;
    const row = candidate;
    const type = typeof row.type === 'string' && row.type.trim().length > 0 ? row.type.trim() : '';
    if (!type) return null;
    const payload = row.payload && typeof row.payload === 'object' ? {
        ...row.payload
    } : {};
    return {
        type,
        payload
    };
}
function withFallbackPayload(state, actorId, action) {
    const lowerType = String(action.type ?? '').toLowerCase();
    const payload = asRecord(action.payload);
    const pending = asRecord(state.pending);
    const choices = asArray(pending.choices).map(String).filter(Boolean);
    const firstChoice = choices[0] ?? null;
    const players = asArray(state.players).map((p)=>asRecord(p)).map((p)=>Number(p.id)).filter((id)=>Number.isFinite(id));
    const targetPlayerId = players.find((id)=>id !== actorId) ?? players[0] ?? actorId;
    const meta = asRecord(state.metadata);
    const hands = asRecord(meta.hands);
    const actorHand = asArray(hands[String(actorId)] ?? hands[actorId]).map(String).filter(Boolean);
    const firstCard = actorHand[0] ?? null;
    if (lowerType === 'cat_pattes_set_config') {
        if (typeof payload.goalPattes !== 'number') payload.goalPattes = 1000;
    }
    if (lowerType === 'lama_set_config') {
        payload.loseAtScore = Number(payload.loseAtScore ?? 40);
        payload.roundPauseSeconds = Number(payload.roundPauseSeconds ?? 1);
        payload.allowPlayAfterDraw = payload.allowPlayAfterDraw ?? true;
        payload.startingHandSize = Number(payload.startingHandSize ?? 5);
        payload.copiesPerCardValue = Number(payload.copiesPerCardValue ?? 8);
        payload.allowDrawAfterFirstQuit = payload.allowDrawAfterFirstQuit ?? true;
        payload.returnTokenFromRound = Number(payload.returnTokenFromRound ?? 3);
    }
    if (lowerType === 'choose_pawn' || lowerType === 'pick_pawn') {
        if (payload.pawnId == null && firstChoice) payload.pawnId = firstChoice;
        if (payload.pawnId == null && payload.pawn == null) payload.pawn = 'chat';
    }
    if (lowerType === 'choose_family' && payload.familyId == null && firstChoice) {
        payload.familyId = firstChoice;
    }
    if (lowerType === 'choose_target' && payload.targetPlayerId == null) {
        payload.targetPlayerId = targetPlayerId;
    }
    if (lowerType === 'choose_winner' && payload.winnerId == null) {
        payload.winnerId = targetPlayerId;
    }
    if (lowerType === 'choose_answer' || lowerType === 'vote_answer') {
        if (payload.answerIndex == null) payload.answerIndex = 0;
    }
    if (lowerType === 'set_theme' && payload.theme == null) {
        payload.theme = firstChoice ?? 'Theme test';
    }
    if (lowerType === 'sac_set_variant' && payload.variant == null) {
        payload.variant = firstChoice ?? 'classic';
    }
    if ((lowerType === 'play_card' || lowerType === 'discard_card' || lowerType === 'ask_card' || lowerType === 'request_card' || lowerType === 'select_card') && payload.cardId == null && firstCard) {
        payload.cardId = firstCard;
    }
    if ((lowerType === 'ask_card' || lowerType === 'request_card') && payload.targetPlayerId == null) {
        payload.targetPlayerId = targetPlayerId;
    }
    if (lowerType === 'form_circle') {
        const cardIds = asArray(payload.cardIds).map(String).filter(Boolean);
        if (cardIds.length < 6 && actorHand.length >= 6) {
            payload.cardIds = actorHand.slice(0, 6);
        }
    }
    return {
        ...action,
        payload
    };
}
function asShortcut(value) {
    return value != null && typeof value === 'object' ? value : {};
}
function keyFromShortcut(hint) {
    const row = asShortcut(hint);
    const raw = typeof row.key === 'string' ? row.key.trim().toUpperCase() : '';
    if (!raw) return '';
    const prefix = 'PRESSED ';
    return raw.startsWith(prefix) ? raw.slice(prefix.length).trim() : raw;
}
function collectCandidates(handler, state, actorId, extraActionTypes) {
    const out = [];
    const seen = new Set();
    const pushCandidate = (candidate)=>{
        const action = toAction(candidate);
        if (!action) return;
        const sig = `${action.type}|${JSON.stringify(action.payload ?? {})}`;
        if (seen.has(sig)) return;
        seen.add(sig);
        out.push(action);
    };
    const available = handler.getAvailableActions?.(state, actorId) ?? [];
    for (const action of available){
        pushCandidate(action);
    }
    const exposed = handler.exposeStateForUser?.(state, actorId);
    for (const action of Array.isArray(exposed?.actions) ? exposed.actions : []){
        pushCandidate(action);
    }
    const shortcuts = handler.getShortcuts?.({
        metadata: state.metadata && typeof state.metadata === 'object' ? state.metadata : {},
        currentPlayerId: typeof state.turn?.currentPlayerId === 'number' ? state.turn.currentPlayerId : null,
        started: String(state.status ?? '').toLowerCase() === 'started'
    });
    for (const hint of Array.isArray(shortcuts) ? shortcuts : []){
        const shortcut = asShortcut(hint);
        const key = keyFromShortcut(shortcut);
        if (!key) continue;
        if (shortcut.type !== 'action') continue;
        if (key === 'X' || key === 'ENTER') continue;
        const type = typeof shortcut.actionType === 'string' ? shortcut.actionType.trim() : '';
        if (!type) continue;
        pushCandidate({
            type,
            payload: {}
        });
    }
    for (const type of extraActionTypes){
        pushCandidate({
            type,
            payload: {}
        });
    }
    return out;
}
function deepClone(value) {
    try {
        return structuredClone(value);
    } catch  {
        return JSON.parse(JSON.stringify(value));
    }
}
function listFiles(rootDir) {
    const out = [];
    const stack = [
        rootDir
    ];
    while(stack.length > 0){
        const current = stack.pop();
        if (!current) continue;
        let entries = [];
        try {
            entries = _nodefs.readdirSync(current, {
                withFileTypes: true
            });
        } catch  {
            continue;
        }
        for (const entry of entries){
            const abs = _nodepath.join(current, entry.name);
            if (entry.isDirectory()) stack.push(abs);
            else out.push(abs);
        }
    }
    return out;
}
function resolveGameRootsById() {
    const roots = new Map();
    const files = listFiles(_nodepath.resolve(process.cwd(), 'src', 'game', 'games')).filter((file)=>file.endsWith('.service.ts') && !file.includes('/actions/'));
    for (const file of files){
        let raw = '';
        try {
            raw = _nodefs.readFileSync(file, 'utf8');
        } catch  {
            continue;
        }
        const hit = raw.match(/\bgameType\s*=\s*['"]([^'"]+)['"]/);
        if (!hit?.[1]) continue;
        roots.set(hit[1], _nodepath.dirname(file));
    }
    return roots;
}
function extractActionTypesFromSource(gameRoot) {
    const actionDir = _nodepath.join(gameRoot, 'actions');
    const out = new Set();
    const files = listFiles(actionDir).filter((file)=>file.endsWith('action.service.ts'));
    for (const file of files){
        let raw = '';
        try {
            raw = _nodefs.readFileSync(file, 'utf8');
        } catch  {
            continue;
        }
        const keyRegex = /\b([a-z][a-z0-9_]*)\s*:\s*\(\)\s*=>/g;
        let m = null;
        while((m = keyRegex.exec(raw)) !== null){
            const key = String(m[1] ?? '').trim();
            if (!key) continue;
            if (key === 'default') continue;
            out.add(key);
        }
    }
    return [
        ...out
    ];
}
function mutateStateVariants(state, actorId, step) {
    const states = [
        state
    ];
    const meta = asRecord(state.metadata);
    const statuses = asRecord(meta.statuses);
    const inJail = asRecord(statuses.inJail);
    const doubles = asRecord(statuses.consecutiveDoubles);
    const positions = asRecord(meta.positions);
    const money = asRecord(meta.money);
    const tilesLen = asArray(meta.tiles).length;
    const clone1 = deepClone(state);
    clone1.turn = {
        ...clone1.turn ?? {},
        currentPlayerId: actorId,
        direction: 1
    };
    clone1.status = 'started';
    clone1.phase = String(clone1.phase ?? 'playing');
    states.push(clone1);
    if (clone1.pending) {
        const clone2 = deepClone(clone1);
        clone2.pending = null;
        states.push(clone2);
    }
    if (Object.keys(inJail).length > 0 || Object.keys(doubles).length > 0) {
        const clone3 = deepClone(clone1);
        const clone3Meta = asRecord(clone3.metadata);
        const clone3Statuses = asRecord(clone3Meta.statuses);
        const clone3InJail = asRecord(clone3Statuses.inJail);
        const clone3Doubles = asRecord(clone3Statuses.consecutiveDoubles);
        clone3InJail[String(actorId)] = step % 3;
        clone3Doubles[String(actorId)] = step % 3;
        clone3Statuses.inJail = clone3InJail;
        clone3Statuses.consecutiveDoubles = clone3Doubles;
        clone3Meta.statuses = clone3Statuses;
        clone3.metadata = clone3Meta;
        states.push(clone3);
    }
    if (Object.keys(positions).length > 0 && tilesLen > 0) {
        const clone4 = deepClone(clone1);
        const clone4Meta = asRecord(clone4.metadata);
        const clone4Pos = asRecord(clone4Meta.positions);
        clone4Pos[String(actorId)] = step % tilesLen;
        clone4Meta.positions = clone4Pos;
        clone4.metadata = clone4Meta;
        states.push(clone4);
    }
    if (Object.keys(money).length > 0) {
        const clone5 = deepClone(clone1);
        const clone5Meta = asRecord(clone5.metadata);
        const clone5Money = asRecord(clone5Meta.money);
        const moneyOptions = [
            0,
            50,
            200,
            1000,
            2500
        ];
        clone5Money[String(actorId)] = moneyOptions[step % moneyOptions.length];
        clone5Meta.money = clone5Money;
        clone5.metadata = clone5Meta;
        states.push(clone5);
    }
    const seen = new Set();
    const deduped = [];
    for (const row of states){
        const sig = JSON.stringify({
            status: row.status,
            phase: row.phase,
            turn: row.turn,
            pending: row.pending,
            metadata: {
                statuses: asRecord(asRecord(row.metadata).statuses),
                positions: asRecord(asRecord(row.metadata).positions),
                money: asRecord(asRecord(row.metadata).money),
                setupStep: asRecord(row.metadata).setupStep
            }
        });
        if (seen.has(sig)) continue;
        seen.add(sig);
        deduped.push(row);
    }
    return deduped;
}
function withScenarioPayload(state, actorId, action, variantIndex) {
    const base = withFallbackPayload(state, actorId, action);
    const payload = asRecord(base.payload);
    const lowerType = String(base.type ?? '').toLowerCase();
    const pending = asRecord(state.pending);
    const pendingData = asRecord(pending.data);
    const pendingOptions = asArray(pendingData.options ?? pending.options ?? pending.choices);
    const players = asArray(state.players).map((p)=>asRecord(p)).map((p)=>Number(p.id)).filter((id)=>Number.isFinite(id));
    const nextPlayer = players[(players.indexOf(actorId) + 1 + variantIndex) % players.length] ?? actorId;
    if (lowerType === 'choose_property') {
        const options = pendingOptions.map((x)=>asRecord(x));
        const pick = options[variantIndex % Math.max(1, options.length)] ?? {};
        const tileIndex = toNumberValue(pick.tileIndex) ?? toNumberValue(pick.index) ?? toNumberValue(payload.tileIndex);
        if (tileIndex != null) payload.tileIndex = tileIndex;
    }
    if (lowerType === 'choose_target' || lowerType === 'choose_next_player' || lowerType === 'choose_winner') {
        payload.targetPlayerId = nextPlayer;
        payload.playerId = nextPlayer;
        payload.winnerId = nextPlayer;
    }
    if (lowerType === 'choose_next_delta') {
        const values = [
            1,
            2,
            3,
            -1,
            -2
        ];
        payload.delta = values[variantIndex % values.length];
    }
    if (lowerType === 'choose_answer' || lowerType === 'vote_answer') {
        payload.answerIndex = variantIndex % 4;
    }
    if (lowerType.endsWith('_set_config') || lowerType === 'set_config' || lowerType.includes('config')) {
        payload.value = variantIndex % 4;
        payload.target = payload.target ?? 'default';
        payload.speed = payload.speed ?? variantIndex % 3 + 1;
    }
    if (lowerType.endsWith('set_variant') || lowerType === 'sac_set_variant') {
        const variants = [
            'classic',
            'gaia',
            'mythique',
            'chaos'
        ];
        payload.variant = variants[variantIndex % variants.length];
        payload.variantId = payload.variant;
    }
    if (lowerType === 'choose_pawn' || lowerType === 'pick_pawn') {
        const pawns = [
            'chat',
            'chien',
            'lampe',
            'oiseau'
        ];
        payload.pawn = payload.pawn ?? pawns[variantIndex % pawns.length];
        payload.pawnId = payload.pawnId ?? payload.pawn;
    }
    if (lowerType === 'roll') {
        payload.force = variantIndex % 6;
    }
    return {
        ...base,
        payload
    };
}
describe('All games scenario coverage harness', ()=>{
    const HARNESS_CAMPAIGNS = Math.max(1, Number(process.env.GAME_SCENARIO_CAMPAIGNS ?? 3));
    const HARNESS_STEPS = Math.max(48, Number(process.env.GAME_SCENARIO_STEPS ?? 128));
    const CANDIDATE_LIMIT = Math.max(6, Number(process.env.GAME_SCENARIO_CANDIDATES ?? 16));
    const STATE_VARIANT_LIMIT = Math.max(1, Number(process.env.GAME_SCENARIO_STATE_VARIANTS ?? 4));
    const PAYLOAD_VARIANT_LIMIT = Math.max(1, Number(process.env.GAME_SCENARIO_PAYLOAD_VARIANTS ?? 3));
    let moduleRef;
    let registry;
    beforeAll(async ()=>{
        const env = readBackendEnv();
        moduleRef = await _testing.Test.createTestingModule({
            imports: [
                _typeorm.TypeOrmModule.forRoot({
                    type: 'mysql',
                    host: process.env.DB_HOST || env.DB_HOST || '127.0.0.1',
                    port: Number(process.env.DB_PORT || env.DB_PORT || 3306),
                    username: process.env.DB_USER || env.DB_USER || 'root',
                    password: process.env.DB_PASSWORD || env.DB_PASSWORD || '',
                    database: process.env.DB_NAME || env.DB_NAME || 'le_monde_de_lila',
                    autoLoadEntities: true,
                    synchronize: false
                }),
                _gameregistrymodule.GameRegistryModule,
                _gamepluginsmodule.GamePluginsModule.forRoot()
            ]
        }).compile();
        await moduleRef.init();
        registry = moduleRef.get(_gameregistryservice.GameRegistryService);
    });
    afterAll(async ()=>{
        if (moduleRef) {
            await moduleRef.close();
        }
    });
    it('hydrates and runs multi-step action flows for every registered game', async ()=>{
        const defs = await registry.listGames({
            includeDisabledOverrides: true
        });
        const failures = [];
        const stats = [];
        const gameRootsById = resolveGameRootsById();
        for (const def of defs){
            const handler = registry.getHandler(def.id);
            if (!handler) {
                failures.push(`${def.id}: handler missing`);
                continue;
            }
            try {
                const totalPlayers = Math.max(2, Math.min(4, Number(handler.maxPlayers ?? def.maxPlayers ?? 4)));
                const gameRoot = gameRootsById.get(def.id);
                const sourceActionTypes = gameRoot ? extractActionTypesFromSource(gameRoot) : [];
                let totalAppliedSteps = 0;
                for(let campaign = 0; campaign < HARNESS_CAMPAIGNS; campaign += 1){
                    const seed = 123456 + campaign * 7919;
                    const baseState = createBaseState(def.id, totalPlayers);
                    baseState.metadata = {
                        ...baseState.metadata,
                        rng: {
                            seed,
                            counter: 0
                        }
                    };
                    let state = handler.hydrateInitialState(baseState);
                    state = handler.applyActions(state, []);
                    let appliedSteps = 0;
                    let idleSteps = 0;
                    for(let step = 0; step < HARNESS_STEPS; step += 1){
                        if (handler.exposeStateForUser) {
                            void handler.exposeStateForUser(state, 1);
                        } else if (handler.exposeState) {
                            void handler.exposeState(state);
                        }
                        const pending = asRecord(state.pending);
                        const pendingPlayerId = typeof pending.playerId === 'number' ? pending.playerId : null;
                        const activeId = pendingPlayerId ?? (typeof state.turn?.currentPlayerId === 'number' ? state.turn.currentPlayerId : 1);
                        const players = asArray(state.players).map((p)=>asRecord(p)).map((p)=>Number(p.id)).filter((id)=>Number.isFinite(id));
                        if (handler.getBotActions) {
                            void handler.getBotActions(state, activeId);
                        }
                        if (handler.getBotStrategy) {
                            void handler.getBotStrategy();
                        }
                        if (handler.shouldAnnounceBoardArrivals) {
                            void handler.shouldAnnounceBoardArrivals();
                        }
                        const actorOrder = [
                            activeId,
                            ...players.filter((id)=>id !== activeId)
                        ];
                        const candidates = actorOrder.flatMap((actorId)=>collectCandidates(handler, state, actorId, sourceActionTypes).map((action)=>({
                                    actorId,
                                    action
                                })));
                        if (candidates.length === 0) {
                            idleSteps += 1;
                            if (idleSteps >= 12) break;
                            continue;
                        }
                        const rotation = (step + campaign) % candidates.length;
                        const rotated = [
                            ...candidates.slice(rotation),
                            ...candidates.slice(0, rotation)
                        ];
                        const ordered = campaign % 3 === 1 ? [
                            ...rotated
                        ].reverse() : campaign % 3 === 2 ? [
                            ...rotated
                        ].sort((a, b)=>String(a.action.type).localeCompare(String(b.action.type))) : rotated;
                        let applied = false;
                        for (const candidate of ordered.slice(0, CANDIDATE_LIMIT)){
                            const stateVariants = mutateStateVariants(state, candidate.actorId, step + campaign).slice(0, STATE_VARIANT_LIMIT);
                            for (const candidateState of stateVariants){
                                for(let payloadVariant = 0; payloadVariant < PAYLOAD_VARIANT_LIMIT; payloadVariant += 1){
                                    const action = withScenarioPayload(candidateState, candidate.actorId, candidate.action, step + campaign + payloadVariant);
                                    const actionWithMeta = {
                                        ...action,
                                        meta: {
                                            ...asRecord(action.meta),
                                            actorId: candidate.actorId
                                        }
                                    };
                                    const attempts = [
                                        actionWithMeta
                                    ];
                                    if (handler.validateAction) {
                                        for (const actorVariant of [
                                            candidate.actorId,
                                            null
                                        ]){
                                            try {
                                                const validated = handler.validateAction(candidateState, actionWithMeta, actorVariant);
                                                attempts.unshift({
                                                    ...validated,
                                                    meta: {
                                                        ...asRecord(validated.meta),
                                                        actorId: candidate.actorId
                                                    }
                                                });
                                            } catch  {
                                            // Keep raw action attempt too.
                                            }
                                        }
                                    }
                                    for (const attemptAction of attempts){
                                        try {
                                            state = handler.applyActions(candidateState, [
                                                attemptAction
                                            ]);
                                            applied = true;
                                            appliedSteps += 1;
                                            idleSteps = 0;
                                            break;
                                        } catch  {
                                        // Try other payload/state/action variants.
                                        }
                                    }
                                    if (applied) break;
                                }
                                if (applied) break;
                            }
                            if (applied) break;
                        }
                        if (!applied) {
                            idleSteps += 1;
                            if (idleSteps >= 12) break;
                            continue;
                        }
                        const status = String(state.status ?? '').toLowerCase();
                        if (status === 'finished') break;
                    }
                    totalAppliedSteps += appliedSteps;
                    stats.push({
                        gameId: `${def.id}#${campaign + 1}`,
                        appliedSteps
                    });
                }
                expect(totalAppliedSteps).toBeGreaterThan(0);
            } catch (err) {
                failures.push(`${def.id}: ${err instanceof Error ? err.message : String(err)}`);
            }
        }
        if (process.env.GAME_SCENARIO_DEBUG === '1') {
            const sorted = [
                ...stats
            ].sort((a, b)=>a.appliedSteps - b.appliedSteps);
            console.log('GAME_SCENARIO_STEPS', sorted.map((s)=>`${s.gameId}:${s.appliedSteps}`).join(', '));
        }
        expect(failures).toEqual([]);
    });
});
