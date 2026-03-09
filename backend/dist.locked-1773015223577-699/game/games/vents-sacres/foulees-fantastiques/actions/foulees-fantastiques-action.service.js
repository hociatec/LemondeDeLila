"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
Object.defineProperty(exports, "FouleesFantastiquesActionService", {
    enumerable: true,
    get: function() {
        return FouleesFantastiquesActionService;
    }
});
const _common = require("@nestjs/common");
const _actionservicehelper = require("../../../../actions/action-service.helper");
const _playernamehelper = require("../../../../modules/turn-policies/player-name.helper");
const _randomservice = require("../../../../modules/random/services/random.service");
const _turnflowservice = require("../../../../modules/turn/services/turn-flow.service");
const _gamecoreservice = require("../../../../core/services/game-core.service");
const _setupflowservice = require("../../../../modules/setup-flow/services/setup-flow.service");
const _familydefinition = require("../definitions/family.definition");
const _fouleesfantastiquessetupservice = require("../setup/foulees-fantastiques-setup.service");
function _ts_decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for(var i = decorators.length - 1; i >= 0; i--)if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function _ts_metadata(k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
}
let FouleesFantastiquesActionService = class FouleesFantastiquesActionService {
    applyActions(state, actions) {
        const status = String(state.status ?? '').toLowerCase();
        if (status !== 'started') return state;
        const next = (0, _actionservicehelper.applyActionsSequentially)(state, actions, (next, action)=>{
            const type = (0, _actionservicehelper.normalizeActionType)(action);
            return (0, _actionservicehelper.dispatchByActionType)(type, {
                choose_family: ()=>{
                    next = this.handleChooseFamily(next, action);
                    return next;
                },
                roll: ()=>{
                    next = this.handleRoll(next);
                    return next;
                },
                move_pawn: ()=>{
                    next = this.handleMovePawn(next, action);
                    return next;
                }
            }, ()=>next);
        });
        return next;
    }
    ensureFamilyPending(state) {
        const meta = state.metadata ?? {};
        const players = Array.isArray(state.players) ? state.players : [];
        if (!players.length) return state;
        const familyIdByPlayer = meta.familyIdByPlayer ?? {};
        const familyByPlayer = meta.familyByPlayer ?? {};
        const allChosen = players.every((p)=>{
            const f = familyIdByPlayer[p.id];
            return typeof f === 'string' && f.trim().length > 0;
        });
        if (allChosen) {
            let next = {
                ...state,
                phase: 'turn',
                pending: null
            };
            const habitatByPlayer = meta.habitatByPlayer ?? {};
            const pawnNamesByPlayer = meta.pawnNamesByPlayer ?? {};
            for (const p of players){
                const color = meta.colorsByPlayer?.[p.id];
                const family = familyByPlayer[p.id];
                const habitat = habitatByPlayer[p.id];
                const pawns = pawnNamesByPlayer[p.id];
                if (!family || !habitat || !Array.isArray(pawns) || pawns.length !== 4) {
                    continue;
                }
                next = this.core.appendLog(next, `${p.username} reçoit les pions ${color}. Famille des ${family} (${habitat}) : ${pawns.join(', ')}.`);
            }
            next = this.core.appendLog(next, 'Début de partie.');
            return this.appendTurnAnnouncement(next);
        }
        const currentId = state.turn?.currentPlayerId ?? players[0]?.id ?? null;
        if (currentId == null) return state;
        // Si le joueur courant a déjà choisi, passer au suivant.
        const already = familyIdByPlayer[currentId];
        if (typeof already === 'string' && already.trim().length > 0) {
            const advanced = this.turns.advanceTurn({
                ...state,
                pending: null
            });
            return this.ensureFamilyPending(advanced);
        }
        const taken = new Set(Object.values(familyIdByPlayer).filter((v)=>typeof v === 'string').map((v)=>v.trim().toLowerCase()).filter(Boolean));
        const available = _familydefinition.FOULEES_FAMILY_PACKS.filter((f)=>!taken.has(f.id));
        const usable = available.length > 0 ? available : _familydefinition.FOULEES_FAMILY_PACKS;
        const usableChoices = usable.map(_familydefinition.toFouleesFamilyChoice);
        const pending = this.setupFlow.createSequentialChoicePending({
            players,
            startPlayerId: currentId,
            isAssigned: (playerId)=>{
                const fid = familyIdByPlayer[playerId];
                return typeof fid === 'string' && fid.trim().length > 0;
            },
            pendingType: 'choose_family',
            choices: usableChoices,
            labelForPlayer: ()=>_familydefinition.FOULEES_FAMILY_PENDING_LABEL,
            dataBuilder: (choices)=>({
                    familyIds: choices.map((choice)=>choice.id)
                })
        })?.pending;
        const withPending = {
            ...state,
            pending: pending ?? null
        };
        const prompt = `${(0, _playernamehelper.resolvePlayerNameFromState)(withPending, currentId)} doit choisir une famille d'animaux.`;
        return this.appendLogOnce(withPending, prompt);
    }
    handleChooseFamily(state, action) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        const pending = state.pending ?? null;
        if (!pending || pending.type !== 'choose_family' || pending.playerId !== currentId) {
            return state;
        }
        const withPrompt = this.appendLogOnce(state, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, currentId)} doit choisir une famille d'animaux.`);
        const meta = withPrompt.metadata ?? {};
        const rawFamily = action.payload?.familyId ?? action.payload?.value;
        const selected = this.setupFlow.resolveChoice(rawFamily, _familydefinition.FOULEES_FAMILY_PACKS.map(_familydefinition.toFouleesFamilyChoice));
        if (!selected) {
            return this.core.appendLog(state, 'Famille invalide.');
        }
        const familyId = String(selected.id ?? '').trim().toLowerCase();
        const pack = _familydefinition.FOULEES_FAMILY_PACKS.find((f)=>f.id === familyId);
        if (!pack) {
            return this.core.appendLog(state, 'Famille invalide.');
        }
        const familyIdByPlayer = meta.familyIdByPlayer ?? {};
        const takenByOther = Object.entries(familyIdByPlayer).some(([pid, fid])=>{
            const otherId = Number(pid);
            if (!Number.isFinite(otherId) || otherId === currentId) return false;
            return String(fid ?? '').trim().toLowerCase() === familyId;
        });
        if (takenByOther) {
            return this.core.appendLog(state, 'Cette famille a déjà été choisie par un autre joueur.');
        }
        const nextMeta = {
            ...meta,
            familyIdByPlayer: {
                ...meta.familyIdByPlayer ?? {},
                [currentId]: familyId
            },
            familyByPlayer: {
                ...meta.familyByPlayer ?? {},
                [currentId]: pack.family
            },
            habitatByPlayer: {
                ...meta.habitatByPlayer ?? {},
                [currentId]: pack.habitat
            },
            pawnNamesByPlayer: {
                ...meta.pawnNamesByPlayer ?? {},
                [currentId]: [
                    ...pack.pawns
                ]
            }
        };
        let next = {
            ...withPrompt,
            metadata: nextMeta,
            pending: null
        };
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} choisit la famille des ${pack.family} (${pack.habitat}).`);
        next = this.turns.advanceTurn(next);
        return this.ensureFamilyPending(next);
    }
    handleRoll(state) {
        const status = String(state.status ?? '').toLowerCase();
        if (status !== 'started') return state;
        if (state.pending) return state;
        // Tant que les familles ne sont pas choisies, on force l'étape de setup.
        if (String(state.phase ?? '').toLowerCase().trim() !== 'turn') {
            return this.ensureFamilyPending(state);
        }
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        const meta = state.metadata ?? {};
        const rng = this.random.rollDice(meta, 6);
        const roll = rng.roll;
        let next = {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...rng.meta
            },
            lastRoll: roll
        };
        next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, currentId)} lance le dé : "${roll}".`);
        const moves = this.computeMoves(next, currentId, roll);
        if (moves.length === 0) {
            const blockInfo = this.findBlockingOpponent(next, currentId, roll);
            next = this.core.appendLog(next, blockInfo ?? `${(0, _playernamehelper.resolvePlayerNameFromState)(state, currentId)} ne peut jouer aucun pion.`);
            return this.endTurn(next, roll === 6);
        }
        if (moves.length === 1) {
            next = this.applyMove(next, currentId, moves[0], roll);
            next = this.setup.recomputeBoardView(next);
            if (next.metadata?.winnerId) {
                return next;
            }
            return this.endTurn(next, roll === 6);
        }
        const hasStableExit = roll === 6 && moves.some((m)=>typeof m?.targetProgress === 'number' && m.targetProgress === 0);
        const label = hasStableExit && moves.every((m)=>m.targetProgress === 0) ? `C'est à ${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} de choisir un animal à sortir dans la liste, puis Entrée.` : hasStableExit ? `C'est à ${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} de choisir un animal à sortir ou à jouer dans la liste, puis Entrée.` : `C'est à ${(0, _playernamehelper.resolvePlayerNameFromState)(next, currentId)} de choisir un animal à jouer dans la liste, puis Entrée.`;
        const pending = {
            type: 'choose_pawn',
            label,
            playerId: currentId,
            blocking: true,
            choices: moves.map((m)=>m.label),
            data: {
                roll,
                moves: moves.map((m)=>({
                        pawnIndex: m.pawnIndex,
                        targetProgress: m.targetProgress
                    }))
            }
        };
        return {
            ...next,
            pending
        };
    }
    handleMovePawn(state, action) {
        const status = String(state.status ?? '').toLowerCase();
        if (status !== 'started') return state;
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) return state;
        const pending = state.pending;
        if (!pending || pending.type !== 'choose_pawn' || pending.playerId !== currentId) {
            return state;
        }
        const payload = action?.payload ?? {};
        const pawnIndex = typeof payload.pawnIndex === 'number' ? payload.pawnIndex : Number(payload.pawnIndex);
        const targetProgress = typeof payload.targetProgress === 'number' ? payload.targetProgress : Number(payload.targetProgress);
        if (!Number.isFinite(pawnIndex) || !Number.isFinite(targetProgress)) {
            return state;
        }
        const roll = Number(pending?.data?.roll);
        const pendingMoves = Array.isArray(pending?.data?.moves) ? pending.data.moves : [];
        const matched = pendingMoves.find((m)=>m?.pawnIndex === pawnIndex && m?.targetProgress === targetProgress);
        if (!matched) {
            return state;
        }
        let next = {
            ...state,
            pending: null
        };
        next = this.applyMove(next, currentId, {
            pawnIndex,
            targetProgress
        }, roll);
        next = this.setup.recomputeBoardView(next);
        if (next.metadata?.winnerId) {
            return next;
        }
        return this.endTurn(next, roll === 6);
    }
    computeMoves(state, playerId, roll) {
        const meta = state.metadata ?? {};
        const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId]) ? meta.pawnsByPlayer[playerId] : [];
        const offset = meta.offsets?.[playerId] ?? 0;
        const arrivalProgress = meta.trackLength + meta.homeLength - 1;
        const opponentsOnTrack = this.buildOpponentTrackIndex(state, playerId);
        const occupiedBySelf = new Set();
        for (const pawn of pawns){
            const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
            if (prog >= 0 && prog < meta.trackLength) {
                occupiedBySelf.add((offset + prog) % meta.trackLength);
            }
        }
        const moves = [];
        for (const pawn of pawns){
            const pawnIndex = pawn?.pawnIndex;
            const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
            if (typeof pawnIndex !== 'number') continue;
            if (prog >= arrivalProgress) continue;
            let targetProgress = null;
            if (prog < 0) {
                if (roll === 6) targetProgress = 0;
            } else if (prog >= meta.trackLength) {
                // Abri (maison) : progression spéciale.
                // Règle: pour avancer d'une case dans l'abri, il faut faire le numéro de la prochaine case.
                // Ex: abri 1 -> abri 2 : faire 2, abri 2 -> abri 3 : faire 3, etc.
                const homeIndex = prog - meta.trackLength + 1; // 1..homeLength
                if (homeIndex >= 1 && homeIndex < meta.homeLength) {
                    const required = homeIndex + 1; // 2..homeLength
                    if (roll === required) {
                        targetProgress = prog + 1;
                    }
                }
            } else {
                const nextProg = prog + roll;
                if (nextProg <= arrivalProgress) {
                    // Règle : l'entrée dans la maison doit être "pile".
                    // On ne peut pas dépasser l'entrée de maison dans le même lancer : il faut arriver exactement à trackLength.
                    if (prog < meta.trackLength && nextProg > meta.trackLength) {
                        targetProgress = nextProg === meta.trackLength ? nextProg : null;
                    } else {
                        targetProgress = nextProg;
                    }
                }
            }
            if (targetProgress == null) continue;
            // Nouvelle règle : un pion adverse sur le chemin bloque.
            // Pour avancer, il faut tomber exactement dessus (capture), donc "pile-poil" la distance manquante.
            if (prog >= 0) {
                const blocked = this.isBlockedByOpponentOnPath(meta, offset, prog, targetProgress, roll, opponentsOnTrack);
                if (blocked) {
                    continue;
                }
            }
            if (targetProgress >= 0 && targetProgress < meta.trackLength) {
                const destPos = (offset + targetProgress) % meta.trackLength;
                if (occupiedBySelf.has(destPos)) {
                    continue; // blocage : 2 pions du même joueur sur la même case
                }
                // Interdit de finir sur une case safe occupée par un adversaire (on ne peut pas capturer en safe).
                if (opponentsOnTrack.has(destPos)) {
                    const isSafe = Array.isArray(meta.safeTiles) && meta.safeTiles.includes(destPos);
                    if (isSafe) {
                        continue;
                    }
                }
            }
            const from = this.describeProgress(meta, playerId, prog);
            const to = this.describeProgress(meta, playerId, targetProgress);
            const pawnLabel = this.pawnLabel(state, playerId, pawnIndex);
            moves.push({
                pawnIndex,
                targetProgress,
                label: `${pawnLabel} (${from}) : aller à ${to}`
            });
        }
        return moves;
    }
    buildOpponentTrackIndex(state, viewerPlayerId) {
        const meta = state.metadata ?? {};
        const players = Array.isArray(state.players) ? state.players : [];
        const occupied = new Set();
        for (const p of players){
            if (!p || p.id === viewerPlayerId) continue;
            const offset = meta.offsets?.[p.id] ?? 0;
            const pawns = Array.isArray(meta.pawnsByPlayer?.[p.id]) ? meta.pawnsByPlayer[p.id] : [];
            for (const pawn of pawns){
                const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
                if (prog < 0 || prog >= meta.trackLength) continue;
                occupied.add((offset + prog) % meta.trackLength);
            }
        }
        return occupied;
    }
    isBlockedByOpponentOnPath(meta, myOffset, fromProgress, toProgress, roll, opponentsOnTrack) {
        if (!Number.isFinite(roll) || roll <= 1) return false;
        if (fromProgress < 0) return false;
        const steps = Math.max(0, Math.trunc(roll));
        for(let step = 1; step <= steps; step++){
            const intermediateProgress = fromProgress + step;
            if (intermediateProgress < 0) continue;
            if (intermediateProgress >= meta.trackLength) {
                break;
            }
            const pos = (myOffset + intermediateProgress) % meta.trackLength;
            if (!opponentsOnTrack.has(pos)) {
                continue;
            }
            // On a un pion adverse sur le chemin.
            // Autorisé seulement si on tombe exactement dessus (capture => étape finale).
            if (intermediateProgress !== toProgress) {
                return true;
            }
        }
        return false;
    }
    findBlockingOpponent(state, playerId, roll) {
        const meta = state.metadata ?? {};
        if (!meta || meta.trackLength == null) return null;
        if (!Number.isFinite(roll) || roll <= 1) return null;
        const myPawns = Array.isArray(meta.pawnsByPlayer?.[playerId]) ? meta.pawnsByPlayer[playerId] : [];
        const myOffset = meta.offsets?.[playerId] ?? 0;
        const opponentsOnTrack = this.buildOpponentTrackIndex(state, playerId);
        if (opponentsOnTrack.size === 0) return null;
        let bestDistance = null;
        for (const pawn of myPawns){
            const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
            if (prog < 0 || prog >= meta.trackLength) continue;
            for(let step = 1; step < Math.trunc(roll); step++){
                const intermediateProgress = prog + step;
                if (intermediateProgress >= meta.trackLength) break;
                const pos = (myOffset + intermediateProgress) % meta.trackLength;
                if (opponentsOnTrack.has(pos)) {
                    bestDistance = bestDistance == null ? step : Math.min(bestDistance, step);
                    break;
                }
            }
        }
        if (bestDistance == null) return null;
        const who = (0, _playernamehelper.resolvePlayerNameFromState)(state, playerId);
        return `${who} ne peut pas avancer.`;
    }
    applyMove(state, playerId, move, _roll) {
        const meta = state.metadata ?? {};
        const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId]) ? meta.pawnsByPlayer[playerId] : [];
        const pawn = pawns.find((p)=>p?.pawnIndex === move.pawnIndex);
        if (!pawn) return state;
        const prevProg = typeof pawn.progress === 'number' ? pawn.progress : -1;
        const nextProg = move.targetProgress;
        const updatedPawns = pawns.map((p)=>p?.pawnIndex === move.pawnIndex ? {
                ...p,
                progress: nextProg
            } : p);
        let next = {
            ...state,
            metadata: {
                ...state.metadata ?? {},
                ...meta,
                pawnsByPlayer: {
                    ...meta.pawnsByPlayer ?? {},
                    [playerId]: updatedPawns
                }
            }
        };
        const offset = meta.offsets?.[playerId] ?? 0;
        const pawnLabel = this.pawnOwnedLabel(state, playerId, move.pawnIndex);
        if (prevProg < 0 && nextProg === 0) {
            const pos = (offset + nextProg) % meta.trackLength;
            const habitat = this.habitatLabel(state, playerId);
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} sort ${pawnLabel} ${this.fromHabitat(habitat)} et le place en case ${pos + 1}.`);
        } else {
            if (nextProg >= 0 && nextProg < meta.trackLength) {
                const pos = (offset + nextProg) % meta.trackLength;
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} place ${pawnLabel} en case ${pos + 1}.`);
            } else {
                const homeIndex = nextProg - meta.trackLength + 1;
                if (homeIndex >= 1 && homeIndex <= meta.homeLength) {
                    next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} met ${pawnLabel} dans l'abri (${homeIndex}/${meta.homeLength}).`);
                }
            }
        }
        // Messages clairs pour l'entrée dans la maison / arrivée (sans coordonnées "case x/52").
        if (prevProg >= 0 && prevProg < meta.trackLength && nextProg >= meta.trackLength) {
            const homeIndex = nextProg - meta.trackLength + 1;
            if (homeIndex >= 1 && homeIndex <= meta.homeLength) {
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} entre ${pawnLabel} dans l'abri (${homeIndex}/${meta.homeLength}).`);
            }
        }
        const arrivalProgress = meta.trackLength + meta.homeLength - 1;
        if (prevProg < arrivalProgress && nextProg >= arrivalProgress) {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} met ${pawnLabel} à l'arrivée.`);
        }
        next = this.applyCapture(next, playerId, move.pawnIndex, nextProg);
        if (this.isWinner(next, playerId, arrivalProgress)) {
            next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, playerId)} a gagné !`);
            return {
                ...next,
                status: 'finished',
                metadata: {
                    ...next.metadata ?? {},
                    winnerId: playerId
                }
            };
        }
        return next;
    }
    applyCapture(state, moverId, _moverPawnIndex, moverProgress) {
        const baseMeta = state.metadata ?? {};
        if (!(typeof moverProgress === 'number')) return state;
        if (moverProgress < 0 || moverProgress >= baseMeta.trackLength) return state;
        const moverOffset = baseMeta.offsets?.[moverId] ?? 0;
        const moverPos = (moverOffset + moverProgress) % baseMeta.trackLength;
        const isSafe = Array.isArray(baseMeta.safeTiles) && baseMeta.safeTiles.includes(moverPos);
        if (isSafe) return state;
        const players = Array.isArray(state.players) ? state.players : [];
        let next = state;
        for (const p of players){
            if (p.id === moverId) continue;
            const meta = next.metadata ?? {};
            const pawnsByPlayer = meta.pawnsByPlayer ?? {};
            const offset = meta.offsets?.[p.id] ?? 0;
            const pawns = Array.isArray(pawnsByPlayer?.[p.id]) ? pawnsByPlayer[p.id] : [];
            let changed = false;
            const updated = pawns.map((pawn)=>{
                const prog = typeof pawn?.progress === 'number' ? pawn.progress : -1;
                if (prog < 0 || prog >= meta.trackLength) return pawn;
                const pos = (offset + prog) % meta.trackLength;
                if (pos !== moverPos) return pawn;
                const capturedLabel = this.pawnLabel(state, p.id, pawn.pawnIndex);
                next = this.core.appendLog(next, `${(0, _playernamehelper.resolvePlayerNameFromState)(state, moverId)} capture ${(0, _playernamehelper.resolvePlayerNameFromState)(state, p.id)} (${capturedLabel}) : retour au départ.`);
                changed = true;
                return {
                    ...pawn,
                    progress: -1
                };
            });
            if (changed) {
                next = {
                    ...next,
                    metadata: {
                        ...next.metadata ?? {},
                        ...meta,
                        pawnsByPlayer: {
                            ...pawnsByPlayer,
                            [p.id]: updated
                        }
                    }
                };
            }
        }
        return next;
    }
    endTurn(state, extraTurn) {
        if (extraTurn) {
            const currentId = state.turn?.currentPlayerId ?? null;
            const who = currentId != null ? (0, _playernamehelper.resolvePlayerNameFromState)(state, currentId) : 'Le joueur';
            const next = this.core.appendLog(state, `${who} rejoue.`);
            return this.appendTurnAnnouncement(next);
        }
        const advanced = this.turns.advanceTurn(state);
        return this.appendTurnAnnouncement(advanced);
    }
    appendTurnAnnouncement(state) {
        const currentId = state.turn?.currentPlayerId ?? null;
        if (currentId == null) {
            return state;
        }
        const message = `C'est au tour de ${(0, _playernamehelper.resolvePlayerNameFromState)(state, currentId)}.`;
        return this.appendLogOnce(state, message);
    }
    appendLogOnce(state, message) {
        const log = Array.isArray(state.log) ? state.log : [];
        const lastMessage = String(log[log.length - 1]?.message ?? '').trim();
        if (lastMessage === message) {
            return state;
        }
        return this.core.appendLog(state, message);
    }
    isWinner(state, playerId, pathLen) {
        const meta = state.metadata ?? {};
        const pawns = Array.isArray(meta.pawnsByPlayer?.[playerId]) ? meta.pawnsByPlayer[playerId] : [];
        if (pawns.length !== 4) return false;
        return pawns.every((p)=>typeof p?.progress === 'number' && p.progress >= pathLen);
    }
    describeProgress(meta, playerId, progress) {
        if (!Number.isFinite(progress) || progress < 0) {
            return 'départ';
        }
        const arrivalProgress = meta.trackLength + meta.homeLength - 1;
        if (progress >= arrivalProgress) {
            return 'arrivée';
        }
        if (progress < meta.trackLength) {
            const offset = meta.offsets?.[playerId] ?? 0;
            const pos = (offset + progress) % meta.trackLength;
            return `case ${pos + 1}/${meta.trackLength}`;
        }
        const homeIndex = progress - meta.trackLength + 1;
        return `abri ${homeIndex}/${meta.homeLength}`;
    }
    pawnLabel(state, playerId, pawnIndex) {
        const meta = state.metadata ?? {};
        const list = meta?.pawnNamesByPlayer?.[playerId];
        const name = Array.isArray(list) && typeof list[pawnIndex] === 'string' ? String(list[pawnIndex]).trim() : '';
        if (name) return name;
        return `animal ${pawnIndex + 1}`;
    }
    pawnOwnedLabel(state, playerId, pawnIndex) {
        const base = this.pawnLabel(state, playerId, pawnIndex);
        const trimmed = String(base ?? '').trim();
        const lower = trimmed.toLowerCase();
        if (lower.startsWith('son ') || lower.startsWith('sa ') || lower.startsWith('ses ')) {
            return trimmed;
        }
        return `son ${trimmed || `animal ${pawnIndex + 1}`}`;
    }
    habitatLabel(state, playerId) {
        const meta = state.metadata ?? {};
        const habitat = typeof meta?.habitatByPlayer?.[playerId] === 'string' ? String(meta.habitatByPlayer[playerId]).trim() : '';
        return habitat || 'abri de départ';
    }
    fromHabitat(habitat) {
        const raw = String(habitat ?? '').trim();
        const h = raw.toLowerCase();
        if (!raw) return "de l'abri de départ";
        if (h === 'écurie' || h === 'ecurie') return "de l'écurie";
        if (h === 'volière' || h === 'voliere') return 'de la volière';
        if (h === 'primaterie') return 'de la primaterie';
        if (h === 'aquarium') return "de l'aquarium";
        if (/^[aeiouyhàâäéèêëîïôöùûü]/i.test(raw)) {
            return `de l'${raw}`;
        }
        return `du ${raw}`;
    }
    constructor(random, turns, core, setup, setupFlow){
        this.random = random;
        this.turns = turns;
        this.core = core;
        this.setup = setup;
        this.setupFlow = setupFlow;
    }
};
FouleesFantastiquesActionService = _ts_decorate([
    (0, _common.Injectable)(),
    _ts_metadata("design:type", Function),
    _ts_metadata("design:paramtypes", [
        typeof _randomservice.RandomService === "undefined" ? Object : _randomservice.RandomService,
        typeof _turnflowservice.TurnFlowService === "undefined" ? Object : _turnflowservice.TurnFlowService,
        typeof _gamecoreservice.GameCoreService === "undefined" ? Object : _gamecoreservice.GameCoreService,
        typeof _fouleesfantastiquessetupservice.FouleesFantastiquesSetupService === "undefined" ? Object : _fouleesfantastiquessetupservice.FouleesFantastiquesSetupService,
        typeof _setupflowservice.SetupFlowService === "undefined" ? Object : _setupflowservice.SetupFlowService
    ])
], FouleesFantastiquesActionService);
