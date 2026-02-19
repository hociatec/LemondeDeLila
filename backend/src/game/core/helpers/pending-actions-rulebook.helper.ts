import type { GameSingleActionDto } from '../../engine/dto/game-action.dto';

type PendingActionFailureReason =
  | 'not_pending_for_actor'
  | 'wrong_action_type'
  | 'invalid_target';

export type PendingDrawValidationResult =
  | { ok: true; action: GameSingleActionDto }
  | { ok: false; reason: Exclude<PendingActionFailureReason, 'invalid_target'> };

export type PendingChooseTargetValidationResult =
  | { ok: true; action: GameSingleActionDto; targetPlayerId: number }
  | { ok: false; reason: PendingActionFailureReason; targetPlayerId?: number };

export type PendingIndexedChoiceValidationResult =
  | { ok: true; action: GameSingleActionDto; choiceIndex: number }
  | {
      ok: false;
      reason: 'not_pending_for_actor' | 'wrong_action_type' | 'invalid_choice';
      choiceIndex?: number;
    };

export type PendingStringChoiceValidationResult =
  | { ok: true; action: GameSingleActionDto; option: string }
  | {
      ok: false;
      reason: 'not_pending_for_actor' | 'wrong_action_type' | 'invalid_option';
      option?: string;
    };

export type PendingNumberChoiceValidationResult =
  | { ok: true; action: GameSingleActionDto; value: number }
  | {
      ok: false;
      reason: 'not_pending_for_actor' | 'wrong_action_type' | 'invalid_value';
      value?: number;
    };

export type PendingNumberSetChoiceValidationResult =
  | { ok: true; action: GameSingleActionDto; value: number }
  | {
      ok: false;
      reason: 'not_pending_for_actor' | 'wrong_action_type' | 'invalid_value';
      value?: number;
    };

export type PendingCardChoiceValidationResult =
  | { ok: true; action: GameSingleActionDto; cardType: string; cardId: number }
  | {
      ok: false;
      reason: 'not_pending_for_actor' | 'wrong_action_type' | 'invalid_card';
    };

function defaultSamePlayer(a: unknown, b: unknown): boolean {
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

function getChoicesFromPending(params: {
  pending: any;
  choicesContainer: 'data' | 'root';
  choicesKey: string;
}): unknown[] {
  if (params.choicesContainer === 'root') {
    return Array.isArray(params.pending?.[params.choicesKey])
      ? params.pending[params.choicesKey]
      : [];
  }
  return Array.isArray(params.pending?.data?.[params.choicesKey])
    ? params.pending.data[params.choicesKey]
    : [];
}

export function getPendingDrawActionsForPlayer(
  pending: any,
  playerId: number,
  options?: {
    pendingType?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
  },
): GameSingleActionDto[] {
  const pendingType = String(options?.pendingType ?? '').trim() || 'draw';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;
  if (!pending || pending.type !== pendingType) return [];
  if (!samePlayer(pending.playerId, playerId)) return [];
  return [{ type: pendingType, payload: {} }];
}

export function validatePendingDrawActionForActor(params: {
  pending: any;
  actorId: number;
  actionType: string;
  pendingType?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
}): PendingDrawValidationResult {
  const pendingType = String(params.pendingType ?? '').trim() || 'draw';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;
  if (!params.pending || params.pending.type !== pendingType) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(params.pending.playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== pendingType) {
    return { ok: false, reason: 'wrong_action_type' };
  }
  return { ok: true, action: { type: pendingType, payload: {} } };
}

export function getPendingChooseTargetActionsForPlayer(
  pending: any,
  playerId: number,
  options?: {
    pendingType?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
    targetKey?: string;
    targetsKey?: string;
  },
): GameSingleActionDto[] {
  const pendingType = String(options?.pendingType ?? '').trim() || 'choose_target';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;
  const targetKey = String(options?.targetKey ?? '').trim() || 'targetPlayerId';
  const targetsKey = String(options?.targetsKey ?? '').trim() || 'targets';
  if (!pending || pending.type !== pendingType) return [];
  if (!samePlayer(pending.playerId, playerId)) return [];
  const targets: Array<Record<string, any>> = Array.isArray(
    pending?.data?.[targetsKey],
  )
    ? pending.data[targetsKey]
    : [];
  return targets
    .map((target) => Number(target?.[targetKey]))
    .filter((value) => Number.isFinite(value))
    .map((targetPlayerId) => ({
      type: pendingType,
      payload: { [targetKey]: targetPlayerId },
    }));
}

export function validatePendingChooseTargetActionForActor(params: {
  pending: any;
  actorId: number;
  actionType: string;
  payload: any;
  pendingType?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
  targetKey?: string;
  targetsKey?: string;
}): PendingChooseTargetValidationResult {
  const pendingType = String(params.pendingType ?? '').trim() || 'choose_target';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;
  const targetKey = String(params.targetKey ?? '').trim() || 'targetPlayerId';
  const targetsKey = String(params.targetsKey ?? '').trim() || 'targets';
  if (!params.pending || params.pending.type !== pendingType) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(params.pending.playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== pendingType) {
    return { ok: false, reason: 'wrong_action_type' };
  }
  const targets: Array<Record<string, any>> = Array.isArray(
    params.pending?.data?.[targetsKey],
  )
    ? params.pending.data[targetsKey]
    : [];
  const targetPlayerId = Number(params.payload?.[targetKey]);
  if (
    !Number.isFinite(targetPlayerId) ||
    !targets.some((t) => Number(t?.[targetKey]) === targetPlayerId)
  ) {
    return { ok: false, reason: 'invalid_target', targetPlayerId };
  }
  return {
    ok: true,
    targetPlayerId,
    action: { type: pendingType, payload: { [targetKey]: targetPlayerId } },
  };
}

export function getPendingIndexedChoiceActionsForPlayer(
  pending: any,
  playerId: number,
  options?: {
    pendingType?: string;
    actionType?: string;
    payloadIndexKey?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
    choicesContainer?: 'data' | 'root';
    choicesKey?: string;
  },
): GameSingleActionDto[] {
  const pendingType = String(options?.pendingType ?? '').trim() || 'choose_option';
  const actionType = String(options?.actionType ?? '').trim() || pendingType;
  const payloadIndexKey = String(options?.payloadIndexKey ?? '').trim() || 'choiceIndex';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;
  const choicesContainer = options?.choicesContainer ?? 'data';
  const choicesKey = String(options?.choicesKey ?? '').trim() || 'choices';

  if (!pending || pending.type !== pendingType) return [];
  if (!samePlayer(pending.playerId, playerId)) return [];

  const choices = getChoicesFromPending({ pending, choicesContainer, choicesKey });
  return choices.map((_, index) => ({
    type: actionType,
    payload: { [payloadIndexKey]: index },
  }));
}

export function validatePendingIndexedChoiceActionForActor(params: {
  pending: any;
  actorId: number;
  actionType: string;
  payload: any;
  pendingType?: string;
  expectedActionType?: string;
  payloadIndexKey?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
  choicesContainer?: 'data' | 'root';
  choicesKey?: string;
}): PendingIndexedChoiceValidationResult {
  const pendingType = String(params.pendingType ?? '').trim() || 'choose_option';
  const expectedActionType =
    String(params.expectedActionType ?? '').trim() || pendingType;
  const payloadIndexKey = String(params.payloadIndexKey ?? '').trim() || 'choiceIndex';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;
  const choicesContainer = params.choicesContainer ?? 'data';
  const choicesKey = String(params.choicesKey ?? '').trim() || 'choices';

  if (!params.pending || params.pending.type !== pendingType) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(params.pending.playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== expectedActionType) {
    return { ok: false, reason: 'wrong_action_type' };
  }

  const choices = getChoicesFromPending({
    pending: params.pending,
    choicesContainer,
    choicesKey,
  });
  const choiceIndex = Number(params.payload?.[payloadIndexKey]);
  if (
    !Number.isFinite(choiceIndex) ||
    choiceIndex < 0 ||
    choiceIndex >= choices.length
  ) {
    return { ok: false, reason: 'invalid_choice', choiceIndex };
  }

  return {
    ok: true,
    choiceIndex,
    action: { type: expectedActionType, payload: { [payloadIndexKey]: choiceIndex } },
  };
}

export function getPendingStringChoiceActionsForPlayer(
  pending: any,
  playerId: number,
  options?: {
    pendingType?: string;
    actionType?: string;
    payloadOptionKey?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
    choicesContainer?: 'data' | 'root';
    choicesKey?: string;
  },
): GameSingleActionDto[] {
  const pendingType = String(options?.pendingType ?? '').trim() || 'choose_option';
  const actionType = String(options?.actionType ?? '').trim() || pendingType;
  const payloadOptionKey = String(options?.payloadOptionKey ?? '').trim() || 'option';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;
  const choicesContainer = options?.choicesContainer ?? 'root';
  const choicesKey = String(options?.choicesKey ?? '').trim() || 'choices';

  if (!pending || pending.type !== pendingType) return [];
  if (!samePlayer(pending.playerId, playerId)) return [];

  const choices = getChoicesFromPending({ pending, choicesContainer, choicesKey })
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0);

  return choices.map((option) => ({
    type: actionType,
    payload: { [payloadOptionKey]: option },
  }));
}

export function validatePendingStringChoiceActionForActor(params: {
  pending: any;
  actorId: number;
  actionType: string;
  payload: any;
  pendingType?: string;
  expectedActionType?: string;
  payloadOptionKey?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
  choicesContainer?: 'data' | 'root';
  choicesKey?: string;
}): PendingStringChoiceValidationResult {
  const pendingType = String(params.pendingType ?? '').trim() || 'choose_option';
  const expectedActionType =
    String(params.expectedActionType ?? '').trim() || pendingType;
  const payloadOptionKey = String(params.payloadOptionKey ?? '').trim() || 'option';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;
  const choicesContainer = params.choicesContainer ?? 'root';
  const choicesKey = String(params.choicesKey ?? '').trim() || 'choices';

  if (!params.pending || params.pending.type !== pendingType) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(params.pending.playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== expectedActionType) {
    return { ok: false, reason: 'wrong_action_type' };
  }

  const option = String(params.payload?.[payloadOptionKey] ?? '').trim();
  const choices = getChoicesFromPending({
    pending: params.pending,
    choicesContainer,
    choicesKey,
  })
    .map((value) => String(value ?? '').trim())
    .filter((value) => value.length > 0);

  if (!option || !choices.includes(option)) {
    return { ok: false, reason: 'invalid_option', option };
  }

  return {
    ok: true,
    option,
    action: { type: expectedActionType, payload: { [payloadOptionKey]: option } },
  };
}

export function getPendingNumberChoiceActionsForPlayer(
  pending: any,
  playerId: number,
  options?: {
    pendingType?: string;
    actionType?: string;
    payloadValueKey?: string;
    minKey?: string;
    maxKey?: string;
    defaultMin?: number;
    defaultMax?: number;
    samePlayer?: (left: unknown, right: unknown) => boolean;
  },
): GameSingleActionDto[] {
  const pendingType = String(options?.pendingType ?? '').trim() || 'choose_number';
  const actionType = String(options?.actionType ?? '').trim() || pendingType;
  const payloadValueKey = String(options?.payloadValueKey ?? '').trim() || 'value';
  const minKey = String(options?.minKey ?? '').trim() || 'min';
  const maxKey = String(options?.maxKey ?? '').trim() || 'max';
  const defaultMin = Number(options?.defaultMin ?? 1);
  const defaultMax = Number(options?.defaultMax ?? 3);
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;

  if (!pending || pending.type !== pendingType) return [];
  if (!samePlayer(pending.playerId, playerId)) return [];

  const min = Number(pending?.data?.[minKey] ?? defaultMin);
  const max = Number(pending?.data?.[maxKey] ?? defaultMax);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max < min) return [];

  const values: number[] = [];
  for (let value = min; value <= max; value += 1) {
    values.push(value);
  }

  return values.map((value) => ({
    type: actionType,
    payload: { [payloadValueKey]: value },
  }));
}

export function validatePendingNumberChoiceActionForActor(params: {
  pending: any;
  actorId: number;
  actionType: string;
  payload: any;
  pendingType?: string;
  expectedActionType?: string;
  payloadValueKey?: string;
  minKey?: string;
  maxKey?: string;
  defaultMin?: number;
  defaultMax?: number;
  samePlayer?: (left: unknown, right: unknown) => boolean;
}): PendingNumberChoiceValidationResult {
  const pendingType = String(params.pendingType ?? '').trim() || 'choose_number';
  const expectedActionType =
    String(params.expectedActionType ?? '').trim() || pendingType;
  const payloadValueKey = String(params.payloadValueKey ?? '').trim() || 'value';
  const minKey = String(params.minKey ?? '').trim() || 'min';
  const maxKey = String(params.maxKey ?? '').trim() || 'max';
  const defaultMin = Number(params.defaultMin ?? 1);
  const defaultMax = Number(params.defaultMax ?? 3);
  const samePlayer = params.samePlayer ?? defaultSamePlayer;

  if (!params.pending || params.pending.type !== pendingType) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(params.pending.playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== expectedActionType) {
    return { ok: false, reason: 'wrong_action_type' };
  }

  const min = Number(params.pending?.data?.[minKey] ?? defaultMin);
  const max = Number(params.pending?.data?.[maxKey] ?? defaultMax);
  const value = Number(params.payload?.[payloadValueKey]);

  if (
    !Number.isFinite(min) ||
    !Number.isFinite(max) ||
    max < min ||
    !Number.isFinite(value) ||
    value < min ||
    value > max
  ) {
    return { ok: false, reason: 'invalid_value', value };
  }

  return {
    ok: true,
    value,
    action: { type: expectedActionType, payload: { [payloadValueKey]: value } },
  };
}

export function getPendingNumberSetChoiceActionsForPlayer(
  pending: any,
  playerId: number,
  options?: {
    pendingType?: string;
    actionType?: string;
    payloadValueKey?: string;
    valuesKey?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
  },
): GameSingleActionDto[] {
  const pendingType = String(options?.pendingType ?? '').trim() || 'choose_number';
  const actionType = String(options?.actionType ?? '').trim() || pendingType;
  const payloadValueKey = String(options?.payloadValueKey ?? '').trim() || 'value';
  const valuesKey = String(options?.valuesKey ?? '').trim() || 'values';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;

  if (!pending || pending.type !== pendingType) return [];
  if (!samePlayer(pending.playerId, playerId)) return [];

  const values = Array.isArray(pending?.data?.[valuesKey])
    ? pending.data[valuesKey]
        .map((entry: unknown) => Number(entry))
        .filter((entry: number) => Number.isFinite(entry))
    : [];

  return values.map((value: number) => ({
    type: actionType,
    payload: { [payloadValueKey]: value },
  }));
}

export function validatePendingNumberSetChoiceActionForActor(params: {
  pending: any;
  actorId: number;
  actionType: string;
  payload: any;
  pendingType?: string;
  expectedActionType?: string;
  payloadValueKey?: string;
  valuesKey?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
}): PendingNumberSetChoiceValidationResult {
  const pendingType = String(params.pendingType ?? '').trim() || 'choose_number';
  const expectedActionType =
    String(params.expectedActionType ?? '').trim() || pendingType;
  const payloadValueKey = String(params.payloadValueKey ?? '').trim() || 'value';
  const valuesKey = String(params.valuesKey ?? '').trim() || 'values';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;

  if (!params.pending || params.pending.type !== pendingType) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(params.pending.playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== expectedActionType) {
    return { ok: false, reason: 'wrong_action_type' };
  }

  const values = Array.isArray(params.pending?.data?.[valuesKey])
    ? params.pending.data[valuesKey]
        .map((entry: unknown) => Number(entry))
        .filter((entry: number) => Number.isFinite(entry))
    : [];
  const value = Number(params.payload?.[payloadValueKey]);

  if (!Number.isFinite(value) || !values.includes(value)) {
    return { ok: false, reason: 'invalid_value', value };
  }

  return {
    ok: true,
    value,
    action: { type: expectedActionType, payload: { [payloadValueKey]: value } },
  };
}

export function getPendingCardChoiceActionsForPlayer(
  pending: any,
  playerId: number,
  options?: {
    pendingType?: string;
    actionType?: string;
    cardsKey?: string;
    payloadCardTypeKey?: string;
    payloadCardIdKey?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
  },
): GameSingleActionDto[] {
  const pendingType = String(options?.pendingType ?? '').trim() || 'choose_card';
  const actionType = String(options?.actionType ?? '').trim() || pendingType;
  const cardsKey = String(options?.cardsKey ?? '').trim() || 'cards';
  const payloadCardTypeKey =
    String(options?.payloadCardTypeKey ?? '').trim() || 'cardType';
  const payloadCardIdKey =
    String(options?.payloadCardIdKey ?? '').trim() || 'cardId';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;

  if (!pending || pending.type !== pendingType) return [];
  if (!samePlayer(pending.playerId, playerId)) return [];

  const cards = Array.isArray(pending?.data?.[cardsKey]) ? pending.data[cardsKey] : [];
  return cards
    .map((card: any) => ({
      cardType: String(card?.[payloadCardTypeKey] ?? '').trim(),
      cardId: Number(card?.[payloadCardIdKey]),
    }))
    .filter((card: { cardType: string; cardId: number }) =>
      card.cardType.length > 0 && Number.isFinite(card.cardId),
    )
    .map((card: { cardType: string; cardId: number }) => ({
      type: actionType,
      payload: {
        [payloadCardTypeKey]: card.cardType,
        [payloadCardIdKey]: card.cardId,
      },
    }));
}

export function validatePendingCardChoiceActionForActor(params: {
  pending: any;
  actorId: number;
  actionType: string;
  payload: any;
  pendingType?: string;
  expectedActionType?: string;
  cardsKey?: string;
  payloadCardTypeKey?: string;
  payloadCardIdKey?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
}): PendingCardChoiceValidationResult {
  const pendingType = String(params.pendingType ?? '').trim() || 'choose_card';
  const expectedActionType =
    String(params.expectedActionType ?? '').trim() || pendingType;
  const cardsKey = String(params.cardsKey ?? '').trim() || 'cards';
  const payloadCardTypeKey =
    String(params.payloadCardTypeKey ?? '').trim() || 'cardType';
  const payloadCardIdKey =
    String(params.payloadCardIdKey ?? '').trim() || 'cardId';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;

  if (!params.pending || params.pending.type !== pendingType) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(params.pending.playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== expectedActionType) {
    return { ok: false, reason: 'wrong_action_type' };
  }

  const cardType = String(params.payload?.[payloadCardTypeKey] ?? '').trim();
  const cardId = Number(params.payload?.[payloadCardIdKey]);
  const cards = Array.isArray(params.pending?.data?.[cardsKey])
    ? params.pending.data[cardsKey]
    : [];

  const found = cards.some(
    (card: any) =>
      String(card?.[payloadCardTypeKey] ?? '').trim() === cardType &&
      Number(card?.[payloadCardIdKey]) === cardId,
  );
  if (!cardType || !Number.isFinite(cardId) || !found) {
    return { ok: false, reason: 'invalid_card' };
  }

  return {
    ok: true,
    cardType,
    cardId,
    action: {
      type: expectedActionType,
      payload: { [payloadCardTypeKey]: cardType, [payloadCardIdKey]: cardId },
    },
  };
}
