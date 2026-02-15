import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import { SAC_VARIANTS } from '../sac-a-malices-variants';
import { normalizeActionType, normalizeLowerActionType } from '../../../../actions/action-service.helper';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

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

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const meta: any = state.metadata ?? {};
  const setupStep = String(meta?.setupStep ?? '').trim();
  if (setupStep === 'setup_config') {
    const ownerId = typeof meta?.ownerPlayerId === 'number' ? meta.ownerPlayerId : null;
    if (ownerId != null && ownerId === playerId) {
      return SAC_VARIANTS.map((variant) => ({
        type: 'sac_set_variant',
        payload: { variant: variant.id },
      }));
    }
    return [];
  }

  const pending = state.pending as any;
  if (pending?.type === 'buy') {
    if ((pending.playerId ?? null) !== playerId) return [];
    return [{ type: 'buy', payload: {} }, { type: 'skip_buy', payload: {} }];
  }
  if (pending?.type === 'choose_property') {
    if ((pending.playerId ?? null) !== playerId) return [];
    const options: Array<{ tileIndex: number }> = Array.isArray(pending?.data?.options)
      ? pending.data.options
      : [];
    if (!options.length) return [];
    return options.map((opt) => ({
      type: 'choose_property',
      payload: { tileIndex: opt.tileIndex },
    }));
  }

  if ((state.turn?.currentPlayerId ?? null) !== playerId) return [];
  if (state.pending) return [];

  const inJail = Number(meta?.statuses?.inJail?.[playerId] ?? 0) > 0;
  const jailCardCount = Number(meta?.statuses?.getOutOfJail?.[playerId] ?? 0) || 0;
  const defaults = {
    jail: {
      maxTurns: 3,
      autoFine: 100,
      allowPayFine: true,
      allowDoubleEscape: false,
    },
  };
  const rules: any = meta?.rules ?? {};
  const jailRules = { ...defaults.jail, ...(rules?.jail ?? {}) };
  const allowPayFine = Boolean(jailRules.allowPayFine) && Number(jailRules.autoFine ?? 0) > 0;

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
    const meta: any = state.metadata ?? {};
    const setupStep = String(meta?.setupStep ?? '').trim();
    if (setupStep !== 'setup_config') {
      throw new PlayerActionError('Configuration indisponible.', {
        gameType: 'sac-a-malices',
      });
    }
    const ownerId = typeof meta?.ownerPlayerId === 'number' ? meta.ownerPlayerId : null;
    if (ownerId != null && actorId != null && actorId !== ownerId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'sac-a-malices',
        playerId: actorId,
        currentPlayerId: ownerId,
      });
    }
    return { ...action, type: 'sac_set_variant', payload: action.payload ?? {} };
  }

  const pending = state.pending as any;
  if (pending?.type === 'buy') {
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
  if (pending?.type === 'choose_property') {
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
    const options: Array<{ tileIndex: number }> = Array.isArray(pending?.data?.options)
      ? pending.data.options
      : [];
    const tileIndex = Number((action.payload as any)?.tileIndex);
    if (!Number.isFinite(tileIndex) || !options.some((o) => o.tileIndex === tileIndex)) {
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

  if (rawType === 'ROLL_DICE' || normalized === 'roll_dice') {
    return { ...action, type: 'roll', payload: {} };
  }
  return { ...action, type: normalized, payload: {} };
}



