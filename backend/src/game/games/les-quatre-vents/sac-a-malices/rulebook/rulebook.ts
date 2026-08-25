import type { GameStateEntity } from '../../../../core/application/models/game-state.model';
import type { GameSingleActionDto } from '../../../../core/application/models/game-action.model';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../core/domain/errors/public-api';
import { SAC_VARIANTS } from '../sac-a-malices-variants';
import {
  isRollAlias,
  normalizeActionType,
} from '../../../../core/application/helpers/action-service.helper';
import { isStartedState } from '../../../../core/application/helpers/rulebook-guard.helper';

const ALLOWED = new Set([
  'roll',
  'ROLL_DICE',
  'roll_dice',
  'buy',
  'skip_buy',
  'build',
  'sell_building',
  'mortgage',
  'unmortgage',
  'choose_property',
  'pay_fine',
  'use_jail_card',
  'sac_set_variant',
]);

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const meta = asRecord(state.metadata);
  const setupStep =
    typeof meta.setupStep === 'string' ? meta.setupStep.trim() : '';
  if (setupStep === 'setup_config') {
    const ownerId =
      typeof meta.ownerPlayerId === 'number' ? meta.ownerPlayerId : null;
    if (ownerId != null && ownerId === playerId) {
      return SAC_VARIANTS.map((variant) => ({
        type: 'sac_set_variant',
        payload: { variant: variant.id },
      }));
    }
    return [];
  }

  const pending = asRecord(state.pending);
  if (pending.type === 'buy') {
    if ((pending.playerId ?? null) !== playerId) return [];
    return [
      { type: 'buy', payload: {} },
      { type: 'skip_buy', payload: {} },
    ];
  }
  if (pending.type === 'choose_property') {
    if ((pending.playerId ?? null) !== playerId) return [];
    const pendingData = asRecord(pending.data);
    const options: Array<{ tileIndex: number }> = Array.isArray(
      pendingData.options,
    )
      ? pendingData.options.map((item) => {
          const option = asRecord(item);
          return { tileIndex: Number(option.tileIndex) };
        })
      : [];
    if (!options.length) return [];
    return options.map((opt) => ({
      type: 'choose_property',
      payload: { tileIndex: opt.tileIndex },
    }));
  }

  if ((state.turn?.currentPlayerId ?? null) !== playerId) return [];
  if (state.pending) return [];

  const statuses = asRecord(meta.statuses);
  const inJailByPlayer = asRecord(statuses.inJail);
  const jailCardsByPlayer = asRecord(statuses.getOutOfJail);
  const inJail = Number(inJailByPlayer[String(playerId)] ?? 0) > 0;
  const jailCardCount = Number(jailCardsByPlayer[String(playerId)] ?? 0) || 0;
  const defaults = {
    jail: {
      maxTurns: 3,
      autoFine: 100,
      allowPayFine: true,
      allowDoubleEscape: false,
    },
  };
  const rules = asRecord(meta.rules);
  const jailRules = { ...defaults.jail, ...asRecord(rules.jail) };
  const allowPayFine =
    Boolean(jailRules.allowPayFine) && Number(jailRules.autoFine ?? 0) > 0;

  const actions: GameSingleActionDto[] = [
    { type: 'roll', payload: {} },
    { type: 'build', payload: {} },
    { type: 'sell_building', payload: {} },
    { type: 'mortgage', payload: {} },
    { type: 'unmortgage', payload: {} },
  ];
  if (inJail) {
    if (allowPayFine) actions.push({ type: 'pay_fine', payload: {} });
    if (jailCardCount > 0) actions.push({ type: 'use_jail_card', payload: {} });
  }
  return actions;
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const rawType = normalizeActionType(action);
  const normalized = rawType.toLowerCase();
  if (!ALLOWED.has(rawType) && !ALLOWED.has(normalized)) {
    throw new GameValidationError(
      `Action type not allowed: ${rawType || '(empty)'}`,
      {
        gameType: 'sac-a-malices',
        action: rawType,
        allowedActions: Array.from(ALLOWED),
      },
    );
  }

  if (normalized === 'sac_set_variant') {
    const meta = asRecord(state.metadata);
    const setupStep =
      typeof meta.setupStep === 'string' ? meta.setupStep.trim() : '';
    if (setupStep !== 'setup_config') {
      throw new PlayerActionError('Configuration indisponible.', {
        gameType: 'sac-a-malices',
      });
    }
    const ownerId =
      typeof meta.ownerPlayerId === 'number' ? meta.ownerPlayerId : null;
    if (ownerId != null && actorId != null && actorId !== ownerId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'sac-a-malices',
        playerId: actorId,
        currentPlayerId: ownerId,
      });
    }
    return {
      ...action,
      type: 'sac_set_variant',
      payload: action.payload ?? {},
    };
  }

  const pending = asRecord(state.pending);
  if (pending.type === 'buy') {
    const pid = pending.playerId ?? null;
    if (pid != null && actorId != null && actorId !== pid) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'sac-a-malices',
        playerId: actorId,
        currentPlayerId: pid,
      });
    }
    if (normalized === 'buy') return { ...action, type: 'buy', payload: {} };
    return { ...action, type: 'skip_buy', payload: {} };
  }
  if (pending.type === 'choose_property') {
    const pid = pending.playerId ?? null;
    if (pid != null && actorId != null && actorId !== pid) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'sac-a-malices',
        playerId: actorId,
        currentPlayerId: pid,
      });
    }
    if (normalized !== 'choose_property') {
      throw new PlayerActionError('Action non disponible.', {
        gameType: 'sac-a-malices',
      });
    }
    const pendingData = asRecord(pending.data);
    const options: Array<{ tileIndex: number }> = Array.isArray(
      pendingData.options,
    )
      ? pendingData.options.map((item) => {
          const option = asRecord(item);
          return { tileIndex: Number(option.tileIndex) };
        })
      : [];
    const payload = asRecord(action.payload);
    const tileIndex = Number(payload.tileIndex);
    if (
      !Number.isFinite(tileIndex) ||
      !options.some((o) => o.tileIndex === tileIndex)
    ) {
      throw new GameValidationError('Choix invalide.', {
        gameType: 'sac-a-malices',
        tileIndex,
      });
    }
    return { type: 'choose_property', payload: { tileIndex } };
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current != null && actorId != null && actorId !== current) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'sac-a-malices',
      playerId: actorId,
      currentPlayerId: current,
    });
  }

  if (isRollAlias(rawType, normalized)) {
    return { ...action, type: 'roll', payload: {} };
  }
  return { ...action, type: normalized, payload: {} };
}




