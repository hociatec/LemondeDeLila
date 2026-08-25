import type { GameStateEntity } from '../../../../core/application/models/game-state.model';

export function applyContesTargetChoice(input: {
  state: GameStateEntity;
  action: { payload?: Record<string, unknown> };
  appendLog: (state: GameStateEntity, message: string) => GameStateEntity;
  playerName: (state: GameStateEntity, playerId: number) => string;
  swapPositions: (
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
  ) => GameStateEntity;
  setTurnSwap: (
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
  ) => GameStateEntity;
  takeOneBonusToken: (
    state: GameStateEntity,
    fromPlayerId: number,
    toPlayerId: number,
  ) => GameStateEntity;
  startStealTokenChoice: (
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
  ) => GameStateEntity;
  moveTargetToPlayerAndAdvance: (
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
    delta: number,
  ) => GameStateEntity;
  setPending: (
    state: GameStateEntity,
    pending: Record<string, unknown>,
  ) => GameStateEntity;
  startGiveBonusChoice: (
    state: GameStateEntity,
    playerId: number,
    targetPlayerId: number,
  ) => GameStateEntity;
  moveBy: (
    state: GameStateEntity,
    playerId: number,
    delta: number,
    depth: number,
  ) => GameStateEntity;
  applyBonusEffectById: (
    state: GameStateEntity,
    playerId: number,
    cardId: number,
    depth: number,
  ) => GameStateEntity;
  findCardTitle: (
    state: GameStateEntity,
    cardType: string,
    cardId: number,
  ) => string | null;
}): GameStateEntity {
  const pending = input.state.pending as
    | {
        type?: string;
        playerId?: number;
        data?: {
          context?: string;
          targets?: Array<{ targetPlayerId: number; targetUsername: string }>;
        };
      }
    | null;
  if (!pending || pending.type !== 'choose_target') return input.state;

  const playerId = Number(pending.playerId);
  const targetPlayerId = Number(input.action.payload?.targetPlayerId);
  const target = (pending.data?.targets ?? []).find(
    (value) => value.targetPlayerId === targetPlayerId,
  );
  if (!target) return input.state;

  let next: GameStateEntity = { ...input.state, pending: null };
  const ctx = String(pending.data?.context ?? '');

  if (ctx === 'move_other_2') {
    next = input.appendLog(
      next,
      `${input.playerName(next, playerId)} fait avancer ${input.playerName(next, targetPlayerId)} de 2 cases.`,
    );
    return input.moveBy(next, targetPlayerId, 2, 0);
  }

  if (ctx === 'swap_positions' && targetPlayerId === -1) {
    return input.appendLog(
      next,
      `${input.playerName(next, playerId)} refuse l’échange.`,
    );
  }
  if (ctx === 'swap_positions') {
    return input.swapPositions(next, playerId, targetPlayerId);
  }

  if (ctx === 'turn_swap_next') {
    return input.setTurnSwap(next, playerId, targetPlayerId);
  }

  if (ctx === 'song_take_bonus' || ctx === 'steal_bonus') {
    return input.takeOneBonusToken(next, targetPlayerId, playerId);
  }

  if (ctx === 'steal_bonus_or_surprise') {
    return input.startStealTokenChoice(next, playerId, targetPlayerId);
  }

  if (ctx === 'wish_swap') {
    return input.swapPositions(next, playerId, targetPlayerId);
  }

  if (ctx === 'grimoire_voyageur') {
    return input.moveTargetToPlayerAndAdvance(next, playerId, targetPlayerId, 1);
  }

  if (ctx.startsWith('give_drawn_bonus:')) {
    const bonusId = Number(ctx.split(':')[1]);
    if (!Number.isFinite(bonusId)) return next;
    const title = input.findCardTitle(next, 'bonus', bonusId) ?? `Bonus ${bonusId}`;
    next = input.appendLog(
      next,
      `${input.playerName(next, playerId)} donne "${title}" à ${input.playerName(next, targetPlayerId)}.`,
    );
    return input.applyBonusEffectById(next, targetPlayerId, bonusId, 0);
  }

  if (ctx === 'key_gold_choose_target') {
    return input.setPending(next, {
      type: 'choose_option',
      label: `Clé d’or : choisissez l’effet à appliquer à ${input.playerName(next, targetPlayerId)} (Bonus/Malus).`,
      playerId,
      blocking: true,
      choices: ['Bonus', 'Malus'],
      data: { context: `key_gold_choose_type:${targetPlayerId}` },
    });
  }

  if (ctx === 'give_bonus_choose_target') {
    return input.startGiveBonusChoice(next, playerId, targetPlayerId);
  }

  return next;
}




