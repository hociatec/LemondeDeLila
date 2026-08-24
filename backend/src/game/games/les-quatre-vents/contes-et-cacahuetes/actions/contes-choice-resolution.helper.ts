import type { GameStateEntity } from '../../../../application/models/game-state.model';
import { resolvePlayerNameFromState } from '../../../../application/helpers/player-name.helper';
import type { GameSingleActionDto } from '../../../../models/game-action.model';
import type {
  ContesCardType,
  ContesPending,
} from '../model/contes-et-cacahuetes-state.model';

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function applyContesChooseNumber(input: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  setPending: (state: GameStateEntity, pending: ContesPending) => GameStateEntity;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  moveBy: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    depth: number,
  ) => GameStateEntity;
  extractQueuedDrawContinuationData: (
    data: Record<string, unknown>,
  ) => Record<string, unknown>;
}): GameStateEntity {
  const pending = input.state.pending as ContesPending;
  if (!pending || pending.type !== 'choose_number') return input.state;

  const playerId = pending.playerId;
  const value = Number(asRecord(input.action.payload).value);
  if (!Number.isFinite(value)) return input.state;

  let next: GameStateEntity = { ...input.state, pending: null };
  const ctx = String(pending.data.context ?? '');
  if (ctx !== 'laughter_dust') return next;

  const players = Array.isArray(next.players) ? next.players : [];
  const defaultOrder = players
    .map((player) => Number(player?.id))
    .filter((id) => Number.isFinite(id));
  const orderRaw = Array.isArray(pending.data?.order)
    ? pending.data.order
    : defaultOrder;
  const order = orderRaw.filter((id) => Number.isFinite(id));
  const picks: Record<number, number> = {
    ...(pending.data?.picks ?? {}),
    [playerId]: value,
  };

  const nextPlayerId = order.find((id) => picks[id] == null);
  if (nextPlayerId != null) {
    const continuationData = input.extractQueuedDrawContinuationData(
      pending.data ?? {},
    );
    return input.setPending(next, {
      type: 'choose_number',
      label: `PoussiÃƒÂ¨re de rire : ${resolvePlayerNameFromState(next, nextPlayerId)}, choisissez un nombre entre 1 et 3 puis EntrÃƒÂ©e.`,
      playerId: nextPlayerId,
      blocking: true,
      choices: ['1', '2', '3'],
      data: {
        context: 'laughter_dust',
        min: 1,
        max: 3,
        order,
        picks,
        ...continuationData,
      },
    });
  }

  const max = Math.max(...Object.values(picks));
  const winners = Object.entries(picks)
    .filter(([, currentValue]) => currentValue === max)
    .map(([id]) => Number(id))
    .filter((id) => Number.isFinite(id));

  next = input.appendLog(
    next,
    `PoussiÃƒÂ¨re de rire : plus grand choix = ${max}. ${winners.map((id) => resolvePlayerNameFromState(next, id)).join(', ')} ${winners.length > 1 ? 'avancent' : 'avance'} d'1 case.`,
  );
  for (const id of winners) {
    next = input.moveBy(next, id, 1, 0);
  }
  return next;
}

export function applyContesChooseOption(input: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  moveBy: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    depth: number,
  ) => GameStateEntity;
  startChooseTarget: (
    state: GameStateEntity,
    playerId: number,
    context: string,
    label: string,
  ) => GameStateEntity;
  drawAndApply: (
    state: GameStateEntity,
    playerId: number,
    type: ContesCardType,
    depth: number,
  ) => GameStateEntity;
  setStatusBool: (
    state: GameStateEntity,
    key: string,
    playerId: number,
    value: boolean,
  ) => GameStateEntity;
}): GameStateEntity {
  const pending = input.state.pending as ContesPending;
  if (!pending || pending.type !== 'choose_option') return input.state;

  const playerId = pending.playerId;
  const option = toText(asRecord(input.action.payload).option);
  if (!pending.choices.some((choice) => String(choice) === option)) {
    return input.state;
  }

  let next: GameStateEntity = { ...input.state, pending: null };
  const ctx = String(pending.data.context ?? '');

  if (ctx === 'song_choice') {
    if (option === 'Avancer de 3') return input.moveBy(next, playerId, 3, 0);
    if (option === 'Prendre une carte Bonus') {
      return input.startChooseTarget(
        next,
        playerId,
        'song_take_bonus',
        'Choisissez un joueur pour lui prendre une carte Bonus.',
      );
    }
  }

  if (ctx === 'wish_ephemere') {
    if (option === 'Avancer de 2') return input.moveBy(next, playerId, 2, 0);
    if (option === 'Ãƒâ€°changer') {
      return input.startChooseTarget(
        next,
        playerId,
        'wish_swap',
        'Choisissez un joueur pour ÃƒÂ©changer vos positions.',
      );
    }
    if (option === 'Tirer une carte Bonus') {
      return input.drawAndApply(next, playerId, 'bonus', 0);
    }
  }

  if (ctx.startsWith('key_gold_choose_type:')) {
    const targetPlayerId = Number(ctx.split(':')[1]);
    if (!Number.isFinite(targetPlayerId)) return next;
    next = input.setStatusBool(next, 'keyOfGold', playerId, false);
    if (option === 'Bonus') {
      return input.drawAndApply(next, targetPlayerId, 'bonus', 0);
    }
    if (option === 'Malus') {
      return input.drawAndApply(next, targetPlayerId, 'malus', 0);
    }
  }

  return next;
}

export function applyContesChooseCard(input: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  applyBonusEffectById: (
    state: GameStateEntity,
    playerId: number,
    cardId: number,
    depth: number,
  ) => GameStateEntity;
  transferBonusToken: (
    state: GameStateEntity,
    fromId: number,
    toId: number,
    cardId: number,
  ) => GameStateEntity;
  transferSurpriseToken: (
    state: GameStateEntity,
    fromId: number,
    toId: number,
    cardId: number,
  ) => GameStateEntity;
}): GameStateEntity {
  const pending = input.state.pending as ContesPending;
  if (!pending || pending.type !== 'choose_card') return input.state;

  const playerId = pending.playerId;
  const cardType = toText(asRecord(input.action.payload).cardType);
  const cardId = Number(asRecord(input.action.payload).cardId);
  const pick = pending.data.cards.find(
    (card) => card.cardType === cardType && card.cardId === cardId,
  );
  if (!pick) return input.state;

  let next: GameStateEntity = { ...input.state, pending: null };
  const ctx = String(pending.data.context ?? '');

  if (ctx.startsWith('abondance_keep_one:')) {
    next = input.appendLog(
      next,
      `Corne dÃ¢â‚¬â„¢abondance : ${resolvePlayerNameFromState(next, playerId)} garde "${pick.title}".`,
    );
    return input.applyBonusEffectById(next, playerId, cardId, 0);
  }

  if (ctx.startsWith('give_bonus_to:')) {
    const targetId = Number(ctx.split(':')[1]);
    if (!Number.isFinite(targetId)) return next;
    return input.transferBonusToken(next, playerId, targetId, cardId);
  }

  if (ctx.startsWith('steal_token_from:')) {
    const parts = ctx.split(':');
    const fromId = Number(parts[1]);
    const toId = Number(parts[2]);
    if (!Number.isFinite(fromId) || !Number.isFinite(toId)) return next;
    if (toId !== playerId) return next;

    if (cardType === 'bonus') {
      return input.transferBonusToken(next, fromId, toId, cardId);
    }
    if (cardType === 'surprise') {
      return input.transferSurpriseToken(next, fromId, toId, cardId);
    }
  }

  return next;
}




