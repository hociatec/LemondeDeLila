import type { GameSingleActionDto } from '../../../../engine/dto/game-action.dto';
import type { GameStateEntity } from '../../../../core/entities/game-state.entity';
import {
  DAME_NATURE_GAME,
  type DameNatureActionType,
} from '../definitions/game.definition';
import {
  GameValidationError,
  PlayerActionError,
} from '../../../../../common/errors/game-errors';

type DameNatureRuleMeta = {
  decks?: {
    family?: { deck?: unknown[]; discards?: unknown[] };
  };
  pendingAsk?: {
    targetId: number;
    memberId?: string | null;
  } | null;
  pendingQuiz?: {
    playerId: number;
    card?: {
      choices?: string[] | null;
      memberName?: string | null;
      question?: string | null;
    };
  } | null;
  turnProgress?: {
    playerId: number;
    drew: boolean;
    discarded: boolean;
    asked: boolean;
  } | null;
};

function normalizeNumber(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return n;
}

function asMeta(state: GameStateEntity): DameNatureRuleMeta {
  return (state.metadata ?? {}) as DameNatureRuleMeta;
}

function getTurnProgress(meta: DameNatureRuleMeta, playerId: number) {
  const progress = meta.turnProgress;
  if (!progress || progress.playerId !== playerId) {
    return { playerId, drew: false, discarded: false, asked: false };
  }
  return { ...progress, asked: (progress as any).asked ?? false };
}

function getPlayer(state: GameStateEntity, playerId: number): any | null {
  const players = Array.isArray(state.players) ? state.players : [];
  const found = players.find((p: any) => p && p.id === playerId);
  return found ?? null;
}

export function getAvailableActions(
  state: GameStateEntity,
  playerId: number,
): GameSingleActionDto[] {
  const meta = asMeta(state);
  const familyDeck = meta.decks?.family ?? { deck: [], discards: [] };
  const deckAvailable =
    (familyDeck.deck?.length ?? 0) + (familyDeck.discards?.length ?? 0) > 0;

  if (meta.pendingAsk) {
    if (meta.pendingAsk.targetId === playerId) {
      const me = getPlayer(state, playerId);
      const requestedMemberId = meta.pendingAsk.memberId
        ? String(meta.pendingAsk.memberId)
        : null;
      const hasRequested =
        requestedMemberId != null && me != null
          ? (me.hand ?? []).some(
              (c: any) => c && c.memberId === requestedMemberId,
            )
          : false;
      if (!hasRequested) {
        return [
          {
            type: 'answer_ask_card_refuse',
            payload: { accept: false, playerId },
          },
        ];
      }
      return [
        {
          type: 'answer_ask_card_accept',
          payload: { accept: true, playerId },
        },
        {
          type: 'answer_ask_card_refuse',
          payload: { accept: false, playerId },
        },
      ];
    }
    return [];
  }

  if (meta.pendingQuiz) {
    if (meta.pendingQuiz.playerId === playerId) {
      const choices = meta.pendingQuiz.card?.choices ?? [
        'Bonne réponse',
        'Mauvaise réponse',
      ];
      return (choices ?? []).map((choice) => ({
        type: 'answer_quiz',
        payload: { playerId, answer: choice },
      }));
    }
    return [];
  }

  const me = getPlayer(state, playerId);
  const progress = getTurnProgress(meta, playerId);

  const actions: GameSingleActionDto[] = [];
  const canDraw =
    deckAvailable && !progress.drew && (me?.hand?.length ?? 0) < 5;
  if (canDraw) actions.push({ type: 'draw' });

  const canDiscard = !progress.discarded || (me?.hand?.length ?? 0) > 4;
  if (canDiscard && (me?.hand?.length ?? 0) > 0) {
    (me?.hand ?? []).forEach((card: any) => {
      actions.push({
        type: 'discard_card',
        payload: { memberId: card.memberId, familyId: card.familyId },
      });
    });
  }

  if (!progress.asked) {
    actions.push({ type: 'ask_card', payload: { playerId } });
  }

  return actions;
}

export function validateAction(
  state: GameStateEntity,
  action: GameSingleActionDto,
  actorId: number | null,
): GameSingleActionDto {
  const meta = asMeta(state);
  const type = String(action?.type ?? '').trim() as DameNatureActionType;
  if (!DAME_NATURE_GAME.actions.includes(type)) {
    throw new GameValidationError(`Action inconnue: ${type}`, {
      gameType: 'dame-nature',
      action: type,
      allowedActions: DAME_NATURE_GAME.actions,
    });
  }

  const payload = action.payload ?? {};
  const currentId = state.turn?.currentPlayerId ?? null;

  if (meta.pendingAsk) {
    if (
      type !== 'answer_ask_card_accept' &&
      type !== 'answer_ask_card_refuse'
    ) {
      throw new PlayerActionError('Action non disponible', {
        gameType: 'dame-nature',
        playerId: actorId ?? undefined,
        action: type,
        expectedActions: ['answer_ask_card_accept', 'answer_ask_card_refuse'],
      });
    }
    if (actorId == null || actorId !== meta.pendingAsk.targetId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'dame-nature',
        playerId: actorId ?? undefined,
        expectedPlayerId: meta.pendingAsk.targetId,
      });
    }
    return { ...action, type, payload: { ...payload, playerId: actorId } };
  }

  if (meta.pendingQuiz) {
    if (type !== 'answer_quiz') {
      throw new PlayerActionError('Action non disponible', {
        gameType: 'dame-nature',
        playerId: actorId ?? undefined,
        action: type,
        expectedActions: ['answer_quiz'],
      });
    }
    if (actorId == null || actorId !== meta.pendingQuiz.playerId) {
      throw new PlayerActionError("Ce n'est pas votre action.", {
        gameType: 'dame-nature',
        playerId: actorId ?? undefined,
        expectedPlayerId: meta.pendingQuiz.playerId,
      });
    }
    const answer = typeof payload.answer === 'string' ? payload.answer : null;
    if (!answer) {
      throw new GameValidationError('Payload invalide: answer', {
        gameType: 'dame-nature',
        playerId: actorId ?? undefined,
        payload,
      });
    }
    return { ...action, type, payload: { playerId: actorId, answer } };
  }

  if (currentId != null && actorId != null && actorId !== currentId) {
    throw new PlayerActionError("Ce n'est pas votre tour.", {
      gameType: 'dame-nature',
      playerId: actorId,
      currentPlayerId: currentId,
    });
  }

  if (type === 'discard_card') {
    const memberId = payload.memberId != null ? String(payload.memberId) : null;
    if (!memberId) {
      throw new GameValidationError('Payload invalide: memberId', {
        gameType: 'dame-nature',
        playerId: actorId ?? undefined,
        payload,
      });
    }
    const familyId = payload.familyId != null ? String(payload.familyId) : null;
    const normalized: Record<string, unknown> = { memberId };
    if (familyId) normalized.familyId = familyId;
    return { ...action, type, payload: normalized };
  }

  if (type === 'ask_card') {
    const normalized: Record<string, unknown> = {};
    const targetId = normalizeNumber(payload.targetId);
    if (targetId != null) normalized.targetId = targetId;
    const familyId = payload.familyId != null ? String(payload.familyId) : null;
    if (familyId) normalized.familyId = familyId;
    const memberId = payload.memberId != null ? String(payload.memberId) : null;
    if (memberId) normalized.memberId = memberId;
    if (actorId != null) normalized.playerId = actorId;
    return { ...action, type, payload: normalized };
  }

  if (type === 'draw') {
    return {
      ...action,
      type,
      payload: actorId != null ? { playerId: actorId } : payload,
    };
  }

  return { ...action, type };
}

export function actorOverrideAllowed(
  state: GameStateEntity,
  actions: GameSingleActionDto[],
  actorId: number | null,
): boolean {
  if (actorId == null) return false;
  const list = Array.isArray(actions) ? actions : [];
  if (list.length === 0) return false;

  const meta = asMeta(state);
  if (meta.pendingAsk) {
    if (meta.pendingAsk.targetId !== actorId) return false;
    return list.every((a) => {
      const t = String(a?.type ?? '').trim();
      return t === 'answer_ask_card_accept' || t === 'answer_ask_card_refuse';
    });
  }

  if (meta.pendingQuiz) {
    if (meta.pendingQuiz.playerId !== actorId) return false;
    return list.every((a) => String(a?.type ?? '').trim() === 'answer_quiz');
  }

  return false;
}
