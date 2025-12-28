import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  LOUP_GAROU_GAME,
  LoupGarouActionType,
} from '../definitions/game.definition';
import type {
  GarouMetadata,
  GarouRole,
  GarouStep,
} from '../model/loup-garou.types';
import type { GameRulebook } from '../../../../engine/model/game-rulebook.model';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';

function normalizeNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

export function livingIds(state: GameStateEntity): number[] {
  const players = Array.isArray(state.players) ? state.players : [];
  return players
    .filter((p: any) => p && p.alive !== false)
    .map((p: any) => p.id)
    .filter((id) => typeof id === 'number');
}

export function isAlive(
  state: GameStateEntity,
  playerId: number | null,
): boolean {
  if (playerId == null) return false;
  const players = Array.isArray(state.players) ? state.players : [];
  const found: any = players.find((p: any) => p && p.id === playerId);
  return Boolean(found && found.alive !== false);
}

export function roleHolders(meta: GarouMetadata, role: GarouRole): number[] {
  return Object.entries(meta.roles)
    .filter(([, r]) => r === role)
    .map(([id]) => Number(id))
    .filter((id) => Number.isFinite(id));
}

export function uniqueRoleHolder(
  state: GameStateEntity,
  meta: GarouMetadata,
  role: GarouRole,
): number | null {
  const def = LOUP_GAROU_GAME.roles.find((r) => r.id === role);
  if (!def?.unique) return null;
  const holders = roleHolders(meta, role).filter((id) => isAlive(state, id));
  return holders[0] ?? null;
}

export function assertUniqueRole(role: GarouRole): void {
  const def = LOUP_GAROU_GAME.roles.find((r) => r.id === role);
  if (!def?.unique) {
    throw new GameValidationError(`Rôle non-unique: ${role}`, {
      gameType: 'loup-garou',
      role,
    });
  }
}

export function phaseCanEnter(
  state: GameStateEntity,
  meta: GarouMetadata,
  step: GarouStep,
): boolean {
  switch (step) {
    case 'seer': {
      const seer = uniqueRoleHolder(state, meta, 'seer');
      return Boolean(seer && meta.pending.seerUsed !== true);
    }
    case 'cupid': {
      const cupid = uniqueRoleHolder(state, meta, 'cupid');
      return Boolean(meta.firstNight && meta.lovers == null && cupid);
    }
    case 'wolves': {
      const wolves = roleHolders(meta, 'werewolf').filter((id) =>
        isAlive(state, id),
      );
      if (!wolves.length) return false;
      return wolves.some(
        (id) => (meta.pending.wolvesChoices ?? {})[id] == null,
      );
    }
    case 'witch': {
      const witch = uniqueRoleHolder(state, meta, 'witch');
      return Boolean(
        witch &&
        isAlive(state, witch) &&
        meta.pending.witchUsed !== true &&
        !(meta.witchPotions.healUsed && meta.witchPotions.poisonUsed),
      );
    }
    case 'announce':
      return (meta.lastAnnouncement ?? []).length > 0;
    case 'day-vote': {
      const living = livingIds(state);
      return living.some((id) => meta.votes[id] === undefined);
    }
    default:
      return true;
  }
}

export function phaseTurnOwner(
  state: GameStateEntity,
  meta: GarouMetadata,
  step: GarouStep,
): number | null {
  switch (step) {
    case 'seer':
      return uniqueRoleHolder(state, meta, 'seer');
    case 'cupid':
      return uniqueRoleHolder(state, meta, 'cupid');
    case 'wolves': {
      const wolves = roleHolders(meta, 'werewolf').filter((id) =>
        isAlive(state, id),
      );
      const choices = meta.pending.wolvesChoices ?? {};
      const pending = wolves.filter((id) => choices[id] == null);
      return pending[0] ?? null;
    }
    case 'witch':
      return uniqueRoleHolder(state, meta, 'witch');
    case 'day-vote': {
      const living = livingIds(state);
      const pending = living.filter((id) => meta.votes[id] === undefined);
      return pending[0] ?? null;
    }
    default:
      return null;
  }
}

export function actorOverrideAllowed(
  state: GameStateEntity,
  meta: GarouMetadata,
  actorId: number | null,
): boolean {
  if (!isAlive(state, actorId)) return false;
  if (actorId == null) return false;
  switch (meta.step) {
    case 'wolves':
      return meta.roles[actorId] === 'werewolf';
    case 'day-vote':
      return true;
    default:
      return false;
  }
}

export function getAvailableActions(
  state: GameStateEntity,
  meta: GarouMetadata,
  playerId: number,
): GameSingleActionDto[] {
  if (!isAlive(state, playerId) || meta.winner) return [];
  switch (meta.step) {
    case 'seer': {
      const seer = uniqueRoleHolder(state, meta, 'seer');
      if (seer == null || seer !== playerId || meta.pending.seerUsed) return [];
      return livingIds(state)
        .filter((id) => id !== playerId)
        .map((id) => ({ type: 'seer_peek', payload: { targetId: id } }));
    }
    case 'cupid': {
      const cupid = uniqueRoleHolder(state, meta, 'cupid');
      if (cupid == null || cupid !== playerId) return [];
      if (!meta.firstNight || meta.lovers != null) return [];
      const targets = livingIds(state).filter((id) => id !== playerId);
      const actions: GameSingleActionDto[] = [];
      for (let i = 0; i < targets.length; i++) {
        for (let j = i + 1; j < targets.length; j++) {
          actions.push({
            type: 'cupid_link',
            payload: { a: targets[i], b: targets[j] },
          });
        }
      }
      return actions;
    }
    case 'wolves': {
      if (meta.roles[playerId] !== 'werewolf') return [];
      const targets = livingIds(state).filter((id) => id !== playerId);
      return targets.map((id) => ({
        type: 'wolves_choose',
        payload: { targetId: id },
      }));
    }
    case 'witch': {
      const witch = uniqueRoleHolder(state, meta, 'witch');
      if (witch == null || witch !== playerId) return [];
      if (meta.pending.witchUsed) return [];
      if (meta.witchPotions.healUsed && meta.witchPotions.poisonUsed) return [];
      const actions: GameSingleActionDto[] = [];
      const wolvesTarget = meta.pending.wolvesTarget;
      if (!meta.witchPotions.healUsed && wolvesTarget != null) {
        actions.push({
          type: 'witch_decide',
          payload: { save: true, killTargetId: null },
        });
      }
      if (!meta.witchPotions.poisonUsed) {
        const targets = livingIds(state).filter((id) => id !== playerId);
        targets.forEach((t) =>
          actions.push({
            type: 'witch_decide',
            payload: { save: false, killTargetId: t },
          }),
        );
      }
      if (actions.length === 0) {
        actions.push({
          type: 'witch_decide',
          payload: { save: false, killTargetId: null },
        });
      }
      return actions;
    }
    case 'day-vote': {
      const current = state.turn?.currentPlayerId ?? null;
      if (current !== playerId) return [];
      const targets = livingIds(state).filter((id) => id !== playerId);
      const actions = targets.map((id) => ({
        type: 'day_vote',
        payload: { targetId: id },
      }));
      actions.push({ type: 'day_vote', payload: { targetId: -1 } });
      return actions;
    }
    default:
      return [];
  }
}

export function validateAction(
  state: GameStateEntity,
  meta: GarouMetadata,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = String(action?.type ?? '').trim() as LoupGarouActionType;
  if (!LOUP_GAROU_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${type}`, {
      gameType: 'loup-garou',
      action: type,
      allowedActions: LOUP_GAROU_GAME.actions,
    });
  }
  if (!isAlive(state, actorId)) {
    throw new PlayerActionError('Acteur invalide', {
      gameType: 'loup-garou',
      playerId: actorId ?? undefined,
    });
  }

  const step = meta.step;
  const payload = action.payload ?? {};
  const living = new Set(livingIds(state));

  const ensureTarget = (key: string): number => {
    const raw = payload[key];
    const id = normalizeNumber(raw);
    if (id == null) {
      throw new GameValidationError(`Payload invalide: ${key}`, {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        payload,
        field: key,
      });
    }
    if (!living.has(id)) {
      throw new PlayerActionError('Cible invalide', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        targetId: id,
        livingPlayers: Array.from(living),
      });
    }
    return id;
  };

  if (type === 'seer_peek') {
    if (step !== 'seer') {
      throw new PlayerActionError('Action non disponible', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        action: type,
        currentStep: step,
        expectedStep: 'seer',
      });
    }
    const seer = uniqueRoleHolder(state, meta, 'seer');
    if (seer == null || actorId !== seer) {
      throw new PlayerActionError("Ce n'est pas votre rôle.", {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        expectedRole: 'seer',
        expectedPlayerId: seer ?? undefined,
      });
    }
    if (meta.pending.seerUsed) {
      throw new PlayerActionError('Déjà utilisé', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        action: type,
      });
    }
    const targetId = ensureTarget('targetId');
    if (targetId === seer) {
      throw new PlayerActionError('Cible invalide', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        targetId,
        reason: 'cannot-target-self',
      });
    }
    return { ...action, type, payload: { targetId } };
  }

  if (type === 'cupid_link') {
    if (step !== 'cupid') {
      throw new PlayerActionError('Action non disponible', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        action: type,
        currentStep: step,
        expectedStep: 'cupid',
      });
    }
    const cupid = uniqueRoleHolder(state, meta, 'cupid');
    if (cupid == null || actorId !== cupid) {
      throw new PlayerActionError("Ce n'est pas votre rôle.", {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        expectedRole: 'cupid',
        expectedPlayerId: cupid ?? undefined,
      });
    }
    if (!meta.firstNight || meta.lovers != null) {
      throw new PlayerActionError('Action non disponible', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        action: type,
        reason: 'not-first-night-or-already-linked',
      });
    }
    const a = ensureTarget('a');
    const b = ensureTarget('b');
    if (a === b) {
      throw new PlayerActionError('Cible invalide', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        reason: 'cannot-link-same-player',
      });
    }
    return { ...action, type, payload: { a, b } };
  }

  if (type === 'wolves_choose') {
    if (step !== 'wolves') {
      throw new PlayerActionError('Action non disponible', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        action: type,
        currentStep: step,
        expectedStep: 'wolves',
      });
    }
    if (actorId == null) {
      throw new PlayerActionError('Authentification requise', {
        gameType: 'loup-garou',
      });
    }
    if (meta.roles[actorId] !== 'werewolf') {
      throw new PlayerActionError("Ce n'est pas votre rôle.", {
        gameType: 'loup-garou',
        playerId: actorId,
        expectedRole: 'werewolf',
        actualRole: meta.roles[actorId],
      });
    }
    const targetId = ensureTarget('targetId');
    return { ...action, type, payload: { targetId } };
  }

  if (type === 'witch_decide') {
    if (step !== 'witch') {
      throw new PlayerActionError('Action non disponible', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        action: type,
        currentStep: step,
        expectedStep: 'witch',
      });
    }
    const witch = uniqueRoleHolder(state, meta, 'witch');
    if (witch == null || actorId !== witch) {
      throw new PlayerActionError("Ce n'est pas votre rôle.", {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        expectedRole: 'witch',
        expectedPlayerId: witch ?? undefined,
      });
    }
    if (meta.pending.witchUsed) {
      throw new PlayerActionError('Déjà utilisé', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        action: type,
      });
    }
    const save = Boolean(payload.save);
    const rawKill = payload.killTargetId;
    const killTargetIdNum = rawKill == null ? null : normalizeNumber(rawKill);
    if (rawKill != null && killTargetIdNum == null) {
      throw new GameValidationError('Payload invalide: killTargetId', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        payload,
      });
    }
    if (
      killTargetIdNum != null &&
      killTargetIdNum >= 0 &&
      !living.has(killTargetIdNum)
    ) {
      throw new PlayerActionError('Cible invalide', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        targetId: killTargetIdNum,
        livingPlayers: Array.from(living),
      });
    }
    const killTargetId = killTargetIdNum == null ? null : killTargetIdNum;
    return { ...action, type, payload: { save, killTargetId } };
  }

  if (type === 'day_vote') {
    if (step !== 'day-vote') {
      throw new PlayerActionError('Action non disponible', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        action: type,
        currentStep: step,
        expectedStep: 'day-vote',
      });
    }
    const raw = payload.targetId;
    const targetIdNum = raw === null ? null : normalizeNumber(raw);
    if (raw != null && targetIdNum == null) {
      throw new GameValidationError('Payload invalide: targetId', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        payload,
      });
    }
    if (targetIdNum != null && targetIdNum >= 0 && !living.has(targetIdNum)) {
      throw new PlayerActionError('Cible invalide', {
        gameType: 'loup-garou',
        playerId: actorId ?? undefined,
        targetId: targetIdNum,
        livingPlayers: Array.from(living),
      });
    }
    const targetId = targetIdNum == null ? null : targetIdNum;
    return { ...action, type, payload: { targetId } };
  }

  return action;
}

export const LOUP_GAROU_RULEBOOK: GameRulebook<
  GameStateEntity,
  GarouMetadata,
  GarouStep
> = {
  validateAction,
  getAvailableActions,
  canEnterPhase: phaseCanEnter,
  phaseTurnOwner: phaseTurnOwner,
  actorOverrideAllowed,
};
