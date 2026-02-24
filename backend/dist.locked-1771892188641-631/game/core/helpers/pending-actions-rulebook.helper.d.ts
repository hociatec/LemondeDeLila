import type { GameSingleActionDto } from '../../engine/dto/game-action.dto';
type PendingActionFailureReason = 'not_pending_for_actor' | 'wrong_action_type' | 'invalid_target';
export type PendingDrawValidationResult = {
    ok: true;
    action: GameSingleActionDto;
} | {
    ok: false;
    reason: Exclude<PendingActionFailureReason, 'invalid_target'>;
};
export type PendingChooseTargetValidationResult = {
    ok: true;
    action: GameSingleActionDto;
    targetPlayerId: number;
} | {
    ok: false;
    reason: PendingActionFailureReason;
    targetPlayerId?: number;
};
export type PendingIndexedChoiceValidationResult = {
    ok: true;
    action: GameSingleActionDto;
    choiceIndex: number;
} | {
    ok: false;
    reason: 'not_pending_for_actor' | 'wrong_action_type' | 'invalid_choice';
    choiceIndex?: number;
};
export type PendingStringChoiceValidationResult = {
    ok: true;
    action: GameSingleActionDto;
    option: string;
} | {
    ok: false;
    reason: 'not_pending_for_actor' | 'wrong_action_type' | 'invalid_option';
    option?: string;
};
export type PendingNumberChoiceValidationResult = {
    ok: true;
    action: GameSingleActionDto;
    value: number;
} | {
    ok: false;
    reason: 'not_pending_for_actor' | 'wrong_action_type' | 'invalid_value';
    value?: number;
};
export type PendingNumberSetChoiceValidationResult = {
    ok: true;
    action: GameSingleActionDto;
    value: number;
} | {
    ok: false;
    reason: 'not_pending_for_actor' | 'wrong_action_type' | 'invalid_value';
    value?: number;
};
export type PendingCardChoiceValidationResult = {
    ok: true;
    action: GameSingleActionDto;
    cardType: string;
    cardId: number;
} | {
    ok: false;
    reason: 'not_pending_for_actor' | 'wrong_action_type' | 'invalid_card';
};
export declare function getPendingDrawActionsForPlayer(pending: unknown, playerId: number, options?: {
    pendingType?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
}): GameSingleActionDto[];
export declare function validatePendingDrawActionForActor(params: {
    pending: unknown;
    actorId: number;
    actionType: string;
    pendingType?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
}): PendingDrawValidationResult;
export declare function getPendingChooseTargetActionsForPlayer(pending: unknown, playerId: number, options?: {
    pendingType?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
    targetKey?: string;
    targetsKey?: string;
}): GameSingleActionDto[];
export declare function validatePendingChooseTargetActionForActor(params: {
    pending: unknown;
    actorId: number;
    actionType: string;
    payload: unknown;
    pendingType?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
    targetKey?: string;
    targetsKey?: string;
}): PendingChooseTargetValidationResult;
export declare function getPendingIndexedChoiceActionsForPlayer(pending: unknown, playerId: number, options?: {
    pendingType?: string;
    actionType?: string;
    payloadIndexKey?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
    choicesContainer?: 'data' | 'root';
    choicesKey?: string;
}): GameSingleActionDto[];
export declare function validatePendingIndexedChoiceActionForActor(params: {
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
}): PendingIndexedChoiceValidationResult;
export declare function getPendingStringChoiceActionsForPlayer(pending: unknown, playerId: number, options?: {
    pendingType?: string;
    actionType?: string;
    payloadOptionKey?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
    choicesContainer?: 'data' | 'root';
    choicesKey?: string;
}): GameSingleActionDto[];
export declare function validatePendingStringChoiceActionForActor(params: {
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
}): PendingStringChoiceValidationResult;
export declare function getPendingNumberChoiceActionsForPlayer(pending: unknown, playerId: number, options?: {
    pendingType?: string;
    actionType?: string;
    payloadValueKey?: string;
    minKey?: string;
    maxKey?: string;
    defaultMin?: number;
    defaultMax?: number;
    samePlayer?: (left: unknown, right: unknown) => boolean;
}): GameSingleActionDto[];
export declare function validatePendingNumberChoiceActionForActor(params: {
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
}): PendingNumberChoiceValidationResult;
export declare function getPendingNumberSetChoiceActionsForPlayer(pending: unknown, playerId: number, options?: {
    pendingType?: string;
    actionType?: string;
    payloadValueKey?: string;
    valuesKey?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
}): GameSingleActionDto[];
export declare function validatePendingNumberSetChoiceActionForActor(params: {
    pending: unknown;
    actorId: number;
    actionType: string;
    payload: unknown;
    pendingType?: string;
    expectedActionType?: string;
    payloadValueKey?: string;
    valuesKey?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
}): PendingNumberSetChoiceValidationResult;
export declare function getPendingCardChoiceActionsForPlayer(pending: unknown, playerId: number, options?: {
    pendingType?: string;
    actionType?: string;
    cardsKey?: string;
    payloadCardTypeKey?: string;
    payloadCardIdKey?: string;
    samePlayer?: (left: unknown, right: unknown) => boolean;
}): GameSingleActionDto[];
export declare function validatePendingCardChoiceActionForActor(params: {
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
}): PendingCardChoiceValidationResult;
export {};
