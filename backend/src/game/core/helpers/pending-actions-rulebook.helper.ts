import type { GameSingleActionDto } from '../../engine/dto/game-action.dto';

type PendingActionFailureReason =
  | 'not_pending_for_actor'
  | 'wrong_action_type'
  | 'invalid_target';

export type PendingDrawValidationResult =
  | { ok: true; action: GameSingleActionDto }
  | {
      ok: false;
      reason: Exclude<PendingActionFailureReason, 'invalid_target'>;
    };

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

type GenericRecord = Record<string, unknown>;

function asRecord(value: unknown): GenericRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as GenericRecord;
  }
  return {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  return '';
}

function getDataRecord(pending: unknown): GenericRecord {
  return asRecord(asRecord(pending).data);
}

function defaultSamePlayer(a: unknown, b: unknown): boolean {
  const left = Number(a);
  const right = Number(b);
  return Number.isFinite(left) && Number.isFinite(right) && left === right;
}

function getChoicesFromPending(params: {
  pending: unknown;
  choicesContainer: 'data' | 'root';
  choicesKey: string;
}): unknown[] {
  const pendingRecord = asRecord(params.pending);
  if (params.choicesContainer === 'root') {
    return asArray(pendingRecord[params.choicesKey]);
  }
  return asArray(getDataRecord(params.pending)[params.choicesKey]);
}

export function getPendingDrawActionsForPlayer(
  pending: unknown,
  playerId: number,
  options?: {
    pendingType?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
  },
): GameSingleActionDto[] {
  const pendingType = toText(options?.pendingType) || 'draw';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;
  if (!pending || toText(asRecord(pending).type) !== pendingType) return [];
  if (!samePlayer(asRecord(pending).playerId, playerId)) return [];
  return [{ type: pendingType, payload: {} }];
}

export function validatePendingDrawActionForActor(params: {
  pending: unknown;
  actorId: number;
  actionType: string;
  pendingType?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
}): PendingDrawValidationResult {
  const pendingType = toText(params.pendingType) || 'draw';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;
  if (
    !params.pending ||
    toText(asRecord(params.pending).type) !== pendingType
  ) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(asRecord(params.pending).playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== pendingType) {
    return { ok: false, reason: 'wrong_action_type' };
  }
  return { ok: true, action: { type: pendingType, payload: {} } };
}

export function getPendingChooseTargetActionsForPlayer(
  pending: unknown,
  playerId: number,
  options?: {
    pendingType?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
    targetKey?: string;
    targetsKey?: string;
  },
): GameSingleActionDto[] {
  const pendingType = toText(options?.pendingType) || 'choose_target';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;
  const targetKey = toText(options?.targetKey) || 'targetPlayerId';
  const targetsKey = toText(options?.targetsKey) || 'targets';
  if (!pending || toText(asRecord(pending).type) !== pendingType) return [];
  if (!samePlayer(asRecord(pending).playerId, playerId)) return [];
  const targets = asArray(getDataRecord(pending)[targetsKey]).filter(
    (target): target is Record<string, unknown> =>
      Boolean(target) && typeof target === 'object',
  );
  return targets
    .map((target) => Number(target?.[targetKey]))
    .filter((value) => Number.isFinite(value))
    .map((targetPlayerId) => ({
      type: pendingType,
      payload: { [targetKey]: targetPlayerId },
    }));
}

export function validatePendingChooseTargetActionForActor(params: {
  pending: unknown;
  actorId: number;
  actionType: string;
  payload: unknown;
  pendingType?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
  targetKey?: string;
  targetsKey?: string;
}): PendingChooseTargetValidationResult {
  const pendingType = toText(params.pendingType) || 'choose_target';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;
  const targetKey = toText(params.targetKey) || 'targetPlayerId';
  const targetsKey = toText(params.targetsKey) || 'targets';
  if (
    !params.pending ||
    toText(asRecord(params.pending).type) !== pendingType
  ) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(asRecord(params.pending).playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== pendingType) {
    return { ok: false, reason: 'wrong_action_type' };
  }
  const targets = asArray(getDataRecord(params.pending)[targetsKey]).filter(
    (target): target is Record<string, unknown> =>
      Boolean(target) && typeof target === 'object',
  );
  const targetPlayerId = Number(asRecord(params.payload)[targetKey]);
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
  pending: unknown,
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
  const pendingType = toText(options?.pendingType) || 'choose_option';
  const actionType = toText(options?.actionType) || pendingType;
  const payloadIndexKey = toText(options?.payloadIndexKey) || 'choiceIndex';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;
  const choicesContainer = options?.choicesContainer ?? 'data';
  const choicesKey = toText(options?.choicesKey) || 'choices';

  if (!pending || toText(asRecord(pending).type) !== pendingType) return [];
  if (!samePlayer(asRecord(pending).playerId, playerId)) return [];

  const choices = getChoicesFromPending({
    pending,
    choicesContainer,
    choicesKey,
  });
  return choices.map((_, index) => ({
    type: actionType,
    payload: { [payloadIndexKey]: index },
  }));
}

export function validatePendingIndexedChoiceActionForActor(params: {
  pending: unknown;
  actorId: number;
  actionType: string;
  payload: unknown;
  pendingType?: string;
  expectedActionType?: string;
  payloadIndexKey?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
  choicesContainer?: 'data' | 'root';
  choicesKey?: string;
}): PendingIndexedChoiceValidationResult {
  const pendingType = toText(params.pendingType) || 'choose_option';
  const expectedActionType = toText(params.expectedActionType) || pendingType;
  const payloadIndexKey = toText(params.payloadIndexKey) || 'choiceIndex';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;
  const choicesContainer = params.choicesContainer ?? 'data';
  const choicesKey = toText(params.choicesKey) || 'choices';

  if (
    !params.pending ||
    toText(asRecord(params.pending).type) !== pendingType
  ) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(asRecord(params.pending).playerId, params.actorId)) {
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
  const choiceIndex = Number(asRecord(params.payload)[payloadIndexKey]);
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
    action: {
      type: expectedActionType,
      payload: { [payloadIndexKey]: choiceIndex },
    },
  };
}

export function getPendingStringChoiceActionsForPlayer(
  pending: unknown,
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
  const pendingType = toText(options?.pendingType) || 'choose_option';
  const actionType = toText(options?.actionType) || pendingType;
  const payloadOptionKey = toText(options?.payloadOptionKey) || 'option';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;
  const choicesContainer = options?.choicesContainer ?? 'root';
  const choicesKey = toText(options?.choicesKey) || 'choices';

  if (!pending || toText(asRecord(pending).type) !== pendingType) return [];
  if (!samePlayer(asRecord(pending).playerId, playerId)) return [];

  const choices = getChoicesFromPending({
    pending,
    choicesContainer,
    choicesKey,
  })
    .map((value) => toText(value))
    .filter((value) => value.length > 0);

  return choices.map((option) => ({
    type: actionType,
    payload: { [payloadOptionKey]: option },
  }));
}

export function validatePendingStringChoiceActionForActor(params: {
  pending: unknown;
  actorId: number;
  actionType: string;
  payload: unknown;
  pendingType?: string;
  expectedActionType?: string;
  payloadOptionKey?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
  choicesContainer?: 'data' | 'root';
  choicesKey?: string;
}): PendingStringChoiceValidationResult {
  const pendingType = toText(params.pendingType) || 'choose_option';
  const expectedActionType = toText(params.expectedActionType) || pendingType;
  const payloadOptionKey = toText(params.payloadOptionKey) || 'option';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;
  const choicesContainer = params.choicesContainer ?? 'root';
  const choicesKey = toText(params.choicesKey) || 'choices';

  if (
    !params.pending ||
    toText(asRecord(params.pending).type) !== pendingType
  ) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(asRecord(params.pending).playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== expectedActionType) {
    return { ok: false, reason: 'wrong_action_type' };
  }

  const option = toText(asRecord(params.payload)[payloadOptionKey]);
  const choices = getChoicesFromPending({
    pending: params.pending,
    choicesContainer,
    choicesKey,
  })
    .map((value) => toText(value))
    .filter((value) => value.length > 0);

  if (!option || !choices.includes(option)) {
    return { ok: false, reason: 'invalid_option', option };
  }

  return {
    ok: true,
    option,
    action: {
      type: expectedActionType,
      payload: { [payloadOptionKey]: option },
    },
  };
}

export function getPendingNumberChoiceActionsForPlayer(
  pending: unknown,
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
  const pendingType = toText(options?.pendingType) || 'choose_number';
  const actionType = toText(options?.actionType) || pendingType;
  const payloadValueKey = toText(options?.payloadValueKey) || 'value';
  const minKey = toText(options?.minKey) || 'min';
  const maxKey = toText(options?.maxKey) || 'max';
  const defaultMin = Number(options?.defaultMin ?? 1);
  const defaultMax = Number(options?.defaultMax ?? 3);
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;

  if (!pending || toText(asRecord(pending).type) !== pendingType) return [];
  if (!samePlayer(asRecord(pending).playerId, playerId)) return [];

  const min = Number(asRecord(asRecord(pending).data)[minKey] ?? defaultMin);
  const max = Number(asRecord(asRecord(pending).data)[maxKey] ?? defaultMax);
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
  pending: unknown;
  actorId: number;
  actionType: string;
  payload: unknown;
  pendingType?: string;
  expectedActionType?: string;
  payloadValueKey?: string;
  minKey?: string;
  maxKey?: string;
  defaultMin?: number;
  defaultMax?: number;
  samePlayer?: (left: unknown, right: unknown) => boolean;
}): PendingNumberChoiceValidationResult {
  const pendingType = toText(params.pendingType) || 'choose_number';
  const expectedActionType = toText(params.expectedActionType) || pendingType;
  const payloadValueKey = toText(params.payloadValueKey) || 'value';
  const minKey = toText(params.minKey) || 'min';
  const maxKey = toText(params.maxKey) || 'max';
  const defaultMin = Number(params.defaultMin ?? 1);
  const defaultMax = Number(params.defaultMax ?? 3);
  const samePlayer = params.samePlayer ?? defaultSamePlayer;

  if (
    !params.pending ||
    toText(asRecord(params.pending).type) !== pendingType
  ) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(asRecord(params.pending).playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== expectedActionType) {
    return { ok: false, reason: 'wrong_action_type' };
  }

  const min = Number(
    asRecord(asRecord(params.pending).data)[minKey] ?? defaultMin,
  );
  const max = Number(
    asRecord(asRecord(params.pending).data)[maxKey] ?? defaultMax,
  );
  const value = Number(asRecord(params.payload)[payloadValueKey]);

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
  pending: unknown,
  playerId: number,
  options?: {
    pendingType?: string;
    actionType?: string;
    payloadValueKey?: string;
    valuesKey?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
  },
): GameSingleActionDto[] {
  const pendingType = toText(options?.pendingType) || 'choose_number';
  const actionType = toText(options?.actionType) || pendingType;
  const payloadValueKey = toText(options?.payloadValueKey) || 'value';
  const valuesKey = toText(options?.valuesKey) || 'values';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;

  if (!pending || toText(asRecord(pending).type) !== pendingType) return [];
  if (!samePlayer(asRecord(pending).playerId, playerId)) return [];

  const values = asArray(getDataRecord(pending)[valuesKey])
    .map((entry: unknown) => Number(entry))
    .filter((entry: number) => Number.isFinite(entry));

  return values.map((value: number) => ({
    type: actionType,
    payload: { [payloadValueKey]: value },
  }));
}

export function validatePendingNumberSetChoiceActionForActor(params: {
  pending: unknown;
  actorId: number;
  actionType: string;
  payload: unknown;
  pendingType?: string;
  expectedActionType?: string;
  payloadValueKey?: string;
  valuesKey?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
}): PendingNumberSetChoiceValidationResult {
  const pendingType = toText(params.pendingType) || 'choose_number';
  const expectedActionType = toText(params.expectedActionType) || pendingType;
  const payloadValueKey = toText(params.payloadValueKey) || 'value';
  const valuesKey = toText(params.valuesKey) || 'values';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;

  if (
    !params.pending ||
    toText(asRecord(params.pending).type) !== pendingType
  ) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(asRecord(params.pending).playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== expectedActionType) {
    return { ok: false, reason: 'wrong_action_type' };
  }

  const values = asArray(getDataRecord(params.pending)[valuesKey])
    .map((entry: unknown) => Number(entry))
    .filter((entry: number) => Number.isFinite(entry));
  const value = Number(asRecord(params.payload)[payloadValueKey]);

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
  pending: unknown,
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
  const pendingType = toText(options?.pendingType) || 'choose_card';
  const actionType = toText(options?.actionType) || pendingType;
  const cardsKey = toText(options?.cardsKey) || 'cards';
  const payloadCardTypeKey = toText(options?.payloadCardTypeKey) || 'cardType';
  const payloadCardIdKey = toText(options?.payloadCardIdKey) || 'cardId';
  const samePlayer = options?.samePlayer ?? defaultSamePlayer;

  if (!pending || toText(asRecord(pending).type) !== pendingType) return [];
  if (!samePlayer(asRecord(pending).playerId, playerId)) return [];

  const cards = asArray(getDataRecord(pending)[cardsKey]);
  return cards
    .map((entry) => {
      const card = asRecord(entry);
      return {
        cardType: toText(card[payloadCardTypeKey]),
        cardId: Number(card[payloadCardIdKey]),
      };
    })
    .filter(
      (card: { cardType: string; cardId: number }) =>
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
  pending: unknown;
  actorId: number;
  actionType: string;
  payload: unknown;
  pendingType?: string;
  expectedActionType?: string;
  cardsKey?: string;
  payloadCardTypeKey?: string;
  payloadCardIdKey?: string;
  samePlayer?: (left: unknown, right: unknown) => boolean;
}): PendingCardChoiceValidationResult {
  const pendingType = toText(params.pendingType) || 'choose_card';
  const expectedActionType = toText(params.expectedActionType) || pendingType;
  const cardsKey = toText(params.cardsKey) || 'cards';
  const payloadCardTypeKey = toText(params.payloadCardTypeKey) || 'cardType';
  const payloadCardIdKey = toText(params.payloadCardIdKey) || 'cardId';
  const samePlayer = params.samePlayer ?? defaultSamePlayer;

  if (
    !params.pending ||
    toText(asRecord(params.pending).type) !== pendingType
  ) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (!samePlayer(asRecord(params.pending).playerId, params.actorId)) {
    return { ok: false, reason: 'not_pending_for_actor' };
  }
  if (params.actionType !== expectedActionType) {
    return { ok: false, reason: 'wrong_action_type' };
  }

  const cardType = toText(asRecord(params.payload)[payloadCardTypeKey]);
  const cardId = Number(asRecord(params.payload)[payloadCardIdKey]);
  const cards = asArray(getDataRecord(params.pending)[cardsKey]);

  const found = cards.some((entry) => {
    const card = asRecord(entry);
    return (
      toText(card[payloadCardTypeKey]) === cardType &&
      Number(card[payloadCardIdKey]) === cardId
    );
  });
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
