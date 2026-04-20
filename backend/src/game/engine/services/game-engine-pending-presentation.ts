import type { GameStateWithActions } from '../dto/game-action.dto';
import { isRollActionType } from '../../actions/action-service.helper';
import { extractExtras } from './game-engine-extras';

export function attachSyntheticPendingFromActions(
  state: GameStateWithActions,
): GameStateWithActions {
  // Never override a real server pending.
  if (state?.pending) {
    return state;
  }

  const rawActions = Array.isArray(state?.actions) ? state.actions : [];
  if (rawActions.length === 0) {
    return state;
  }

  const types = new Set(
    rawActions
      .map((a) =>
        typeof a?.type === 'string' ? a.type.trim().toLowerCase() : '',
      )
      .filter((t) => t),
  );
  const hasDraw = types.has('draw') || types.has('draw_card');
  if (hasDraw) {
    return state;
  }

  const discardActions = rawActions.filter((a) => {
    const type = typeof a?.type === 'string' ? a.type.trim().toLowerCase() : '';
    return type === 'discard_card';
  });
  if (discardActions.length === 0) {
    // continue
  } else {
    const extras = extractExtras(state);
    const viewerPlayerIdRaw = extras['viewerPlayerId'];
    const viewerPlayerId =
      typeof viewerPlayerIdRaw === 'number' &&
      Number.isFinite(viewerPlayerIdRaw)
        ? viewerPlayerIdRaw
        : null;
    if (viewerPlayerId == null) {
      return state;
    }

    // Optional label index from handCards (when provided by the game).
    const labelByKey = new Map<string, string>();
    const handCards = extras['handCards'];
    if (Array.isArray(handCards)) {
      for (const c of handCards) {
        if (!c || typeof c !== 'object') continue;
        const card = c as {
          familyId?: unknown;
          memberId?: unknown;
          label?: unknown;
        };
        const familyId =
          typeof card.familyId === 'string' ? card.familyId.trim() : '';
        const memberId =
          typeof card.memberId === 'string' ? card.memberId.trim() : '';
        const label = typeof card.label === 'string' ? card.label.trim() : '';
        if (!memberId || !label) continue;
        const key = `${familyId}|${memberId}`;
        if (!labelByKey.has(key)) {
          labelByKey.set(key, label);
        }
      }
    }

    const choices: string[] = [];
    const choiceActionsByIndex: Array<{
      type: string;
      payload: any;
      meta?: any;
    }> = [];

    for (const a of discardActions) {
      const payloadRaw =
        (a as any)?.payload && typeof (a as any).payload === 'object'
          ? ((a as any).payload as Record<string, unknown>)
          : {};
      const memberId =
        typeof payloadRaw.memberId === 'string'
          ? payloadRaw.memberId.trim()
          : '';
      const familyId =
        typeof payloadRaw.familyId === 'string'
          ? payloadRaw.familyId.trim()
          : '';
      if (!memberId) {
        return state;
      }

      const key = `${familyId}|${memberId}`;
      const label = labelByKey.get(key) ?? memberId;
      choices.push(label);
      choiceActionsByIndex.push({
        type: 'discard_card',
        payload: familyId ? { memberId, familyId } : { memberId },
        meta: (a as any)?.meta ?? undefined,
      });
    }

    return {
      ...state,
      pending: {
        type: 'choose_action',
        label: 'Choisissez une carte a defausser, puis Entree.',
        playerId: viewerPlayerId,
        blocking: true,
        choices,
        data: {
          context: 'synthetic:discard_card',
          choiceActionsByIndex,
        },
      },
    };
  }

  // Synthetic ask-card selector (optional): expose a choices list when `ask_card` is available.
  // This replaces client-side AskCardChoiceBuilder for WPF.
  const hasRoll = rawActions.some((a) => isRollActionType(a?.type));
  if (hasRoll) {
    return state;
  }

  const askActions = rawActions.filter((a) => {
    const type = typeof a?.type === 'string' ? a.type.trim().toLowerCase() : '';
    return type === 'ask_card';
  });
  if (askActions.length === 0) {
    return state;
  }

  const extras = extractExtras(state);
  const viewerPlayerIdRaw = extras['viewerPlayerId'];
  const viewerPlayerId =
    typeof viewerPlayerIdRaw === 'number' && Number.isFinite(viewerPlayerIdRaw)
      ? viewerPlayerIdRaw
      : null;
  if (viewerPlayerId == null) {
    return state;
  }

  const usernameById = new Map<number, string>();
  const playerViews = extras['playerViews'];
  if (Array.isArray(playerViews)) {
    for (const p of playerViews) {
      if (!p || typeof p !== 'object') continue;
      const id =
        typeof p.id === 'number' && Number.isFinite(p.id) ? p.id : null;
      const username =
        typeof p.username === 'string' ? String(p.username).trim() : '';
      if (id == null || !username) continue;
      if (!usernameById.has(id)) usernameById.set(id, username);
    }
  } else if (Array.isArray(state.players)) {
    for (const p of state.players) {
      if (!p || typeof p !== 'object') continue;
      const id = typeof p.id === 'number' ? p.id : null;
      const username =
        typeof p.username === 'string' ? String(p.username).trim() : '';
      if (id == null || !username) continue;
      if (!usernameById.has(id)) usernameById.set(id, username);
    }
  }

  const normalizedCardNameById = new Map<string, string>();
  const catalog = extras['catalog'];
  if (catalog && typeof catalog === 'object' && !Array.isArray(catalog)) {
    const catalogRecord = catalog as Record<string, unknown>;
    for (const familyId of Object.keys(catalogRecord)) {
      const list = catalogRecord[familyId];
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        if (!entry || typeof entry !== 'object') continue;
        const id = typeof entry.id === 'string' ? String(entry.id).trim() : '';
        const name =
          typeof entry.name === 'string' ? String(entry.name).trim() : '';
        if (!id || !name) continue;
        const key = id.toLowerCase();
        if (!normalizedCardNameById.has(key)) {
          normalizedCardNameById.set(key, name);
        }
      }
    }
  }

  const choices: string[] = [];
  const choiceActionsByIndex: Array<{
    type: string;
    payload: any;
    meta?: any;
  }> = [];

  for (const a of askActions) {
    const payload =
      (a as any)?.payload && typeof (a as any).payload === 'object'
        ? ((a as any).payload as Record<string, unknown>)
        : {};

    const targetRaw =
      typeof payload.targetPlayerId === 'number'
        ? payload.targetPlayerId
        : typeof payload.targetId === 'number'
          ? payload.targetId
          : null;
    const targetId =
      typeof targetRaw === 'number' && Number.isFinite(targetRaw)
        ? targetRaw
        : null;

    const memberId =
      typeof payload.memberId === 'string'
        ? String(payload.memberId).trim()
        : '';
    const cardId =
      typeof payload.cardId === 'string' ? String(payload.cardId).trim() : '';

    const cardKey = (memberId || cardId).toLowerCase();
    const cardName =
      cardKey && normalizedCardNameById.has(cardKey)
        ? normalizedCardNameById.get(cardKey)!
        : memberId || cardId;
    const targetName =
      targetId != null
        ? (usernameById.get(targetId) ?? `Joueur ${targetId}`)
        : '';

    const label =
      targetName && cardName ? `${targetName} : ${cardName}` : 'ask_card';
    choices.push(label);
    choiceActionsByIndex.push({
      type: 'ask_card',
      payload,
      meta: (a as any)?.meta ?? undefined,
    });
  }

  return {
    ...state,
    pending: {
      type: 'choose_action',
      label: 'Choisissez une demande, puis Entree.',
      playerId: viewerPlayerId,
      blocking: false,
      choices,
      data: {
        context: 'synthetic:ask_card',
        choiceActionsByIndex,
      },
    },
  };
}

export function attachPendingChoiceActions(
  state: GameStateWithActions,
): GameStateWithActions {
  const pending = state?.pending;
  const choices = Array.isArray(pending?.choices) ? pending.choices : [];
  if (!pending || choices.length === 0) {
    return state;
  }

  const rawData =
    pending.data && typeof pending.data === 'object' ? pending.data : {};
  const data: Record<string, unknown> = { ...(rawData as any) };

  // Do not override a game-specific mapping if it already exists.
  if (Array.isArray((data as any).choiceActionsByIndex)) {
    return state;
  }

  const rawActions = Array.isArray(state?.actions) ? state.actions : [];
  const pendingType = String((pending as any)?.type ?? '')
    .trim()
    .toLowerCase();
  const candidates = rawActions.filter((a) => {
    const type = typeof a?.type === 'string' ? a.type.trim() : '';
    if (!type) return false;
    const normalized = type.toLowerCase();
    if (isRollActionType(normalized)) return false;
    if (normalized === 'draw' || normalized === 'draw_card') return false;
    return true;
  });

  if (candidates.length !== choices.length) {
    // Server-side fallback mappings for legacy pending shapes, so thin clients can stay dumb.
    if (pendingType === 'quiz') {
      const answerCount = rawActions.filter((a) => {
        const t = typeof a?.type === 'string' ? a.type.trim() : '';
        return t.toLowerCase() === 'answer_quiz';
      }).length;
      if (answerCount >= choices.length) {
        data.choiceActionsByIndex = choices.map((_, index) => ({
          type: 'answer_quiz',
          payload: { answerIndex: index },
        }));
        return {
          ...state,
          pending: {
            ...pending,
            data,
          },
        };
      }
    }

    if (pendingType === 'exchange' && choices.length === 2) {
      const hasAccept = rawActions.some((a) => {
        const t = typeof a?.type === 'string' ? a.type.trim() : '';
        return t.toLowerCase() === 'exchange_accept';
      });
      const hasRefuse = rawActions.some((a) => {
        const t = typeof a?.type === 'string' ? a.type.trim() : '';
        return t.toLowerCase() === 'exchange_refuse';
      });
      if (hasAccept && hasRefuse) {
        data.choiceActionsByIndex = choices.map((label) => {
          const normalized = String(label ?? '')
            .trim()
            .toLowerCase();
          const type =
            normalized === 'accepter' ? 'exchange_accept' : 'exchange_refuse';
          return { type, payload: {} };
        });
        return {
          ...state,
          pending: {
            ...pending,
            data,
          },
        };
      }
    }

    return state;
  }

  data.choiceActionsByIndex = candidates.map((a) => ({
    type: String(a.type ?? '').trim(),
    payload: (a as any).payload ?? {},
    meta: (a as any).meta ?? undefined,
  }));

  return {
    ...state,
    pending: {
      ...pending,
      data,
    },
  };
}
