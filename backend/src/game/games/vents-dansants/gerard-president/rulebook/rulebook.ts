import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import type { GerardPresidentMetadata } from '../model/gerard-president-state.entity';
import { normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';
import {
  GERARD_PRESIDENT_GAME,
  type GerardPresidentActionType,
} from '../definitions/game.definition';

type GerardPresidentRulePayload = {
  names?: string[];
  cardId?: string;
  targetPlayerId?: number;
  secondaryTargetId?: number;
  name?: string;
  winnerId?: number;
};

function getMeta(state: GameStateEntity): GerardPresidentMetadata {
  return (state.metadata ?? {}) as GerardPresidentMetadata;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];
  const currentPlayer = state.turn?.currentPlayerId ?? null;
  if (currentPlayer !== playerId) return [];
  const meta = getMeta(state);
  const available: GameSingleActionDto[] = [];
  if (
    meta.roundPhase === 'waiting_theme' &&
    meta.masterId === playerId
  ) {
    available.push({ type: 'set_theme' });
    if ((meta.specialHands?.[playerId] ?? []).length) {
      available.push({ type: 'play_special' });
    }
    return available;
  }

  if (
    meta.roundPhase === 'collecting_names' &&
    meta.pendingPlayers.includes(playerId)
  ) {
    available.push({ type: 'play_name' });
    if ((meta.specialHands?.[playerId] ?? []).length) {
      available.push({ type: 'play_special' });
    }
    available.push({ type: 'pass' });
    return available;
  }

  if (
    meta.roundPhase === 'choosing_winner' &&
    (meta.masterId === playerId || meta.juryOverrideId === playerId)
  ) {
    available.push({ type: 'choose_winner' });
    return available;
  }

  return [];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeActionType(action);
  const type = rawType as GerardPresidentActionType;
  if (!GERARD_PRESIDENT_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnueÂ : ${rawType}`, {
      gameType: 'gerard-president',
    });
  }
  if (actorId == null) {
    throw new PlayerActionError('Un joueur doit Ãªtre indiquÃ©.', {
      gameType: 'gerard-president',
    });
  }
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') {
    throw new GameValidationError('La partie nâ€™a pas dÃ©marrÃ©.', {
      gameType: 'gerard-president',
    });
  }
  const meta = getMeta(state);
  const current = state.turn?.currentPlayerId ?? null;
  const payload = (action.payload ?? {}) as GerardPresidentRulePayload;
  if (current !== actorId) {
    throw new PlayerActionError('Ce nâ€™est pas votre tour.', {
      gameType: 'gerard-president',
      playerId: actorId,
    });
  }

  if (type === 'set_theme') {
    if (meta.roundPhase !== 'waiting_theme') {
      throw new GameValidationError('Un thÃ¨me est dÃ©jÃ  en cours.', {
        gameType: 'gerard-president',
      });
    }
    if (
      meta.masterId != null &&
      meta.masterId !== actorId &&
      meta.juryOverrideId !== actorId
    ) {
      throw new PlayerActionError('Vous nâ€™Ãªtes pas le MaÃ®tre du ThÃ¨me.', {
        gameType: 'gerard-president',
        playerId: actorId,
      });
    }
    return { ...action, type };
  }

  if (type === 'play_name') {
    if (meta.roundPhase !== 'collecting_names') {
      throw new GameValidationError('Il faut attendre un thÃ¨me.', {
        gameType: 'gerard-president',
      });
    }
    if (!meta.pendingPlayers.includes(actorId)) {
      throw new PlayerActionError('Vous avez dÃ©jÃ  jouÃ©.', {
        gameType: 'gerard-president',
      });
    }
    const names = Array.isArray(payload.names) ? payload.names : [];
    if (!names.length) {
      throw new GameValidationError('Aucun prÃ©nom sÃ©lectionnÃ©.', {
        gameType: 'gerard-president',
      });
    }
    return { ...action, type, payload: { names } };
  }

  if (type === 'play_special') {
    if (meta.roundPhase === 'choosing_winner') {
      throw new GameValidationError('Impossible de jouer une carte maintenant.', {
        gameType: 'gerard-president',
      });
    }
    const cardId = String(payload.cardId ?? '').trim();
    if (!cardId) {
      throw new GameValidationError('Aucune carte spÃ©cifiÃ©e.', {
        gameType: 'gerard-president',
      });
    }
    const hand = meta.specialHands?.[actorId] ?? [];
    if (!hand.includes(cardId)) {
      throw new GameValidationError('Vous ne possÃ©dez pas cette carte.', {
        gameType: 'gerard-president',
      });
    }
    return { ...action, type, payload: { ...payload, cardId } };
  }

  if (type === 'pass') {
    if (meta.roundPhase !== 'collecting_names') {
      throw new GameValidationError("Vous ne pouvez pas passer maintenant.", {
        gameType: 'gerard-president',
      });
    }
    if (!meta.pendingPlayers.includes(actorId)) {
      throw new PlayerActionError('Vous avez dÃ©jÃ  jouÃ©.', {
        gameType: 'gerard-president',
      });
    }
    return { ...action, type };
  }

  if (type === 'choose_winner') {
    if (meta.roundPhase !== 'choosing_winner') {
      throw new GameValidationError('Il faut dâ€™abord collecter les prÃ©noms.', {
        gameType: 'gerard-president',
      });
    }
    if (meta.masterId != null && meta.masterId !== actorId) {
      throw new PlayerActionError('Vous nâ€™Ãªtes pas le MaÃ®tre du ThÃ¨me.', {
        gameType: 'gerard-president',
      });
    }
    const winnerId = payload.winnerId;
    if (typeof winnerId !== 'number') {
      throw new GameValidationError('Vous devez choisir un gagnant.', {
        gameType: 'gerard-president',
      });
    }
    return { ...action, type, payload: { winnerId } };
  }

  return { ...action, type };
}



