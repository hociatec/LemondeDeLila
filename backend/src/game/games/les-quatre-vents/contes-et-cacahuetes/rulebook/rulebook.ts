import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import {
  isRollActionType,
  normalizeActionType,
} from '../../../../actions/action-service.helper';
import {
  requiredInt,
  requiredString,
} from '../../../../core/helpers/payload-validators.helper';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';
import { isStartedState } from '../../../../rulebook/rulebook-guard.helper';

const GAME_TYPE = 'contes-et-cacahuetes';

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  if (!isStartedState(state)) return [];

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== playerId) return [];

    const type = String(pending.type ?? '').toLowerCase();
    if (type === 'draw') {
      return [{ type: 'draw', payload: {} }];
    }
    if (type === 'choose_pawn') {
      const pawns: Array<{ id?: string }> = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];
      return pawns
        .map((p) => String(p?.id ?? '').trim())
        .filter((id) => id.length > 0)
        .map((id) => ({ type: 'choose_pawn', payload: { pawnId: id } }));
    }
    if (type === 'reroll') {
      return [
        { type: 'reroll_yes', payload: {} },
        { type: 'reroll_no', payload: {} },
      ];
    }
    if (type === 'choose_target') {
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(
        pending?.data?.targets,
      )
        ? pending.data.targets
        : [];
      return targets.map((t) => ({
        type: 'choose_target',
        payload: { targetPlayerId: t.targetPlayerId },
      }));
    }
    if (type === 'choose_number') {
      const min = Number(pending?.data?.min ?? 1);
      const max = Number(pending?.data?.max ?? 3);
      const values: number[] = [];
      for (let v = min; v <= max; v += 1) values.push(v);
      return values.map((v) => ({
        type: 'choose_number',
        payload: { value: v },
      }));
    }
    if (type === 'choose_option') {
      const choices: string[] = Array.isArray(pending?.choices)
        ? pending.choices
        : [];
      return choices.map((c) => ({
        type: 'choose_option',
        payload: { option: c },
      }));
    }
    if (type === 'choose_card') {
      const cards: Array<{ cardType: string; cardId: number }> = Array.isArray(
        pending?.data?.cards,
      )
        ? pending.data.cards
        : [];
      return cards.map((c) => ({
        type: 'choose_card',
        payload: { cardType: c.cardType, cardId: c.cardId },
      }));
    }
    return [];
  }

  const meta: any = state.metadata ?? {};
  const blockedUntilPassed: Record<number, number> =
    meta?.statuses?.blockedUntilPassed ?? {};
  if (typeof blockedUntilPassed[playerId] === 'number') {
    return [];
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== playerId) return [];
  return [{ type: 'roll', payload: {} }];
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const type = normalizeActionType(action);
  const isRoll = isRollActionType(type);
  if (
    !isRoll &&
    type !== 'reroll_yes' &&
    type !== 'reroll_no' &&
    type !== 'choose_target' &&
    type !== 'choose_number' &&
    type !== 'choose_option' &&
    type !== 'choose_card' &&
    type !== 'choose_pawn' &&
    type !== 'draw'
  ) {
    throw new GameValidationError(`Action inconnue: ${type}`, {
      gameType: GAME_TYPE,
      action: { type },
    });
  }
  if (actorId == null)
    throw new PlayerActionError('Acteur requis.', { gameType: GAME_TYPE });

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started')
    throw new PlayerActionError("La partie n'est pas démarrée.", {
      gameType: GAME_TYPE,
    });

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== actorId)
      throw new PlayerActionError('Action réservée à un autre joueur.', {
        gameType: GAME_TYPE,
      });

    const pType = String(pending.type ?? '').toLowerCase();
    if (pType === 'draw') {
      if (type !== 'draw')
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      return { type: 'draw', payload: {} };
    }
    if (pType === 'choose_pawn') {
      if (type !== 'choose_pawn')
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      const pawns: Array<{ id?: string }> = Array.isArray(pending?.data?.pawns)
        ? pending.data.pawns
        : [];
      const payload = (action.payload ?? {}) as any;
      const pawnId = (() => {
        try {
          return requiredString(
            {
              pawnId: payload?.pawnId ?? payload?.pawn ?? payload?.value,
            },
            'pawnId',
            'Pion invalide.',
          );
        } catch {
          throw new GameValidationError('Pion invalide.', {
            gameType: GAME_TYPE,
            action: { type, payload: action.payload ?? null },
          });
        }
      })();
      if (!pawns.some((p) => String(p?.id ?? '').trim() === pawnId))
        throw new GameValidationError('Pion invalide.', {
          gameType: GAME_TYPE,
          action: { type, payload: action.payload ?? null },
        });
      return { type: 'choose_pawn', payload: { pawnId } };
    }
    if (pType === 'reroll') {
      if (type !== 'reroll_yes' && type !== 'reroll_no')
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      return { type, payload: {} };
    }
    if (pType === 'choose_target') {
      if (type !== 'choose_target')
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(
        pending?.data?.targets,
      )
        ? pending.data.targets
        : [];
      const targetPlayerId = (() => {
        try {
          return requiredInt(
            action.payload ?? {},
            'targetPlayerId',
            'Cible invalide.',
          );
        } catch {
          throw new GameValidationError('Cible invalide.', {
            gameType: GAME_TYPE,
            action: { type, payload: action.payload ?? null },
          });
        }
      })();
      if (!targets.some((t) => t.targetPlayerId === targetPlayerId))
        throw new GameValidationError('Cible invalide.', {
          gameType: GAME_TYPE,
          action: { type, payload: action.payload ?? null },
        });
      return { type: 'choose_target', payload: { targetPlayerId } };
    }
    if (pType === 'choose_number') {
      if (type !== 'choose_number')
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      const min = Number(pending?.data?.min ?? 1);
      const max = Number(pending?.data?.max ?? 3);
      const value = (() => {
        try {
          return requiredInt(action.payload ?? {}, 'value', 'Valeur invalide.');
        } catch {
          throw new GameValidationError('Valeur invalide.', {
            gameType: GAME_TYPE,
            action: { type, payload: action.payload ?? null },
          });
        }
      })();
      if (value < min || value > max)
        throw new GameValidationError('Valeur invalide.', {
          gameType: GAME_TYPE,
          action: { type, payload: action.payload ?? null },
        });
      return { type: 'choose_number', payload: { value } };
    }
    if (pType === 'choose_option') {
      if (type !== 'choose_option')
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      const choices: string[] = Array.isArray(pending?.choices)
        ? pending.choices
        : [];
      const option = (() => {
        try {
          return requiredString(
            action.payload ?? {},
            'option',
            'Option invalide.',
          );
        } catch {
          throw new GameValidationError('Option invalide.', {
            gameType: GAME_TYPE,
            action: { type, payload: action.payload ?? null },
          });
        }
      })();
      if (!choices.some((c) => String(c) === option))
        throw new GameValidationError('Option invalide.', {
          gameType: GAME_TYPE,
          action: { type, payload: action.payload ?? null },
        });
      return { type: 'choose_option', payload: { option } };
    }
    if (pType === 'choose_card') {
      if (type !== 'choose_card')
        throw new PlayerActionError('Action non disponible.', {
          gameType: GAME_TYPE,
        });
      const cards: Array<{ cardType: string; cardId: number }> = Array.isArray(
        pending?.data?.cards,
      )
        ? pending.data.cards
        : [];
      const cardType = (() => {
        try {
          return requiredString(
            action.payload ?? {},
            'cardType',
            'Carte invalide.',
          );
        } catch {
          throw new GameValidationError('Carte invalide.', {
            gameType: GAME_TYPE,
            action: { type, payload: action.payload ?? null },
          });
        }
      })();
      const cardId = (() => {
        try {
          return requiredInt(action.payload ?? {}, 'cardId', 'Carte invalide.');
        } catch {
          throw new GameValidationError('Carte invalide.', {
            gameType: GAME_TYPE,
            action: { type, payload: action.payload ?? null },
          });
        }
      })();
      if (
        !cards.some(
          (c) => String(c.cardType) === cardType && Number(c.cardId) === cardId,
        )
      ) {
        throw new GameValidationError('Carte invalide.', {
          gameType: GAME_TYPE,
          action: { type, payload: action.payload ?? null },
        });
      }
      return { type: 'choose_card', payload: { cardType, cardId } };
    }
    throw new PlayerActionError('Action non disponible.', {
      gameType: GAME_TYPE,
    });
  }

  const meta: any = state.metadata ?? {};
  const blockedUntilPassed: Record<number, number> =
    meta?.statuses?.blockedUntilPassed ?? {};
  if (typeof blockedUntilPassed[actorId] === 'number') {
    throw new PlayerActionError(
      'Vous êtes bloqué(e) : attendez qu’un autre joueur vous dépasse.',
      { gameType: GAME_TYPE },
    );
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId)
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: GAME_TYPE,
    });
  return { type: 'roll', payload: {} };
}



