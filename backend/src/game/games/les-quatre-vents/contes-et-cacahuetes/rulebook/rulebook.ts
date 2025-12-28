import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';

export function getAvailableActions(state: GameStateEntity, playerId: number): GameSingleActionDto[] {
  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') return [];

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== playerId) return [];

    const type = String(pending.type ?? '').toLowerCase();
    if (type === 'reroll') {
      return [{ type: 'reroll_yes', payload: {} }, { type: 'reroll_no', payload: {} }];
    }
    if (type === 'choose_target') {
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(pending?.data?.targets)
        ? pending.data.targets
        : [];
      return targets.map((t) => ({ type: 'choose_target', payload: { targetPlayerId: t.targetPlayerId } }));
    }
    if (type === 'choose_number') {
      const min = Number(pending?.data?.min ?? 1);
      const max = Number(pending?.data?.max ?? 3);
      const values: number[] = [];
      for (let v = min; v <= max; v += 1) values.push(v);
      return values.map((v) => ({ type: 'choose_number', payload: { value: v } }));
    }
    if (type === 'choose_option') {
      const choices: string[] = Array.isArray(pending?.choices) ? pending.choices : [];
      return choices.map((c) => ({ type: 'choose_option', payload: { option: c } }));
    }
    if (type === 'choose_card') {
      const cards: Array<{ cardType: string; cardId: number }> = Array.isArray(pending?.data?.cards)
        ? pending.data.cards
        : [];
      return cards.map((c) => ({ type: 'choose_card', payload: { cardType: c.cardType, cardId: c.cardId } }));
    }
    return [];
  }

  const meta: any = state.metadata ?? {};
  const blockedUntilPassed: Record<number, number> = meta?.statuses?.blockedUntilPassed ?? {};
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
  const type = String(action?.type ?? '').trim();
  if (
    type !== 'roll' &&
    type !== 'ROLL_DICE' &&
    type !== 'roll_dice' &&
    type !== 'reroll_yes' &&
    type !== 'reroll_no' &&
    type !== 'choose_target' &&
    type !== 'choose_number' &&
    type !== 'choose_option' &&
    type !== 'choose_card'
  ) {
    throw new Error(`Action inconnue: ${type}`);
  }
  if (actorId == null) throw new Error('Acteur requis');

  const status = String(state.status ?? '').toLowerCase();
  if (status !== 'started') throw new Error("La partie n'est pas démarrée.");

  const pending = state.pending as any;
  if (pending) {
    if (pending.playerId !== actorId) throw new Error("Action réservée à un autre joueur.");

    const pType = String(pending.type ?? '').toLowerCase();
    if (pType === 'reroll') {
      if (type !== 'reroll_yes' && type !== 'reroll_no') throw new Error('Choix invalide.');
      return { type, payload: {} };
    }
    if (pType === 'choose_target') {
      if (type !== 'choose_target') throw new Error('Choix invalide.');
      const targets: Array<{ targetPlayerId: number }> = Array.isArray(pending?.data?.targets)
        ? pending.data.targets
        : [];
      const targetPlayerId = Number((action.payload as any)?.targetPlayerId);
      if (!Number.isFinite(targetPlayerId)) throw new Error('Cible invalide.');
      if (!targets.some((t) => t.targetPlayerId === targetPlayerId)) throw new Error('Cible invalide.');
      return { type: 'choose_target', payload: { targetPlayerId } };
    }
    if (pType === 'choose_number') {
      if (type !== 'choose_number') throw new Error('Choix invalide.');
      const min = Number(pending?.data?.min ?? 1);
      const max = Number(pending?.data?.max ?? 3);
      const value = Number((action.payload as any)?.value);
      if (!Number.isFinite(value) || value < min || value > max) throw new Error('Valeur invalide.');
      return { type: 'choose_number', payload: { value } };
    }
    if (pType === 'choose_option') {
      if (type !== 'choose_option') throw new Error('Choix invalide.');
      const choices: string[] = Array.isArray(pending?.choices) ? pending.choices : [];
      const option = String((action.payload as any)?.option ?? '');
      if (!choices.some((c) => String(c) === option)) throw new Error('Option invalide.');
      return { type: 'choose_option', payload: { option } };
    }
    if (pType === 'choose_card') {
      if (type !== 'choose_card') throw new Error('Choix invalide.');
      const cards: Array<{ cardType: string; cardId: number }> = Array.isArray(pending?.data?.cards)
        ? pending.data.cards
        : [];
      const cardType = String((action.payload as any)?.cardType ?? '');
      const cardId = Number((action.payload as any)?.cardId);
      if (!Number.isFinite(cardId)) throw new Error('Carte invalide.');
      if (!cards.some((c) => String(c.cardType) === cardType && Number(c.cardId) === cardId)) {
        throw new Error('Carte invalide.');
      }
      return { type: 'choose_card', payload: { cardType, cardId } };
    }
    throw new Error('Choix invalide.');
  }

  const meta: any = state.metadata ?? {};
  const blockedUntilPassed: Record<number, number> = meta?.statuses?.blockedUntilPassed ?? {};
  if (typeof blockedUntilPassed[actorId] === 'number') {
    throw new Error('Vous êtes bloqué(e) : attendez qu’un autre joueur vous dépasse.');
  }

  const current = state.turn?.currentPlayerId ?? null;
  if (current !== actorId) throw new Error("Ce n'est pas votre tour.");
  return { type: 'roll', payload: {} };
}

