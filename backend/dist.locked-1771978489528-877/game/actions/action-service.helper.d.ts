import type { GameSingleActionDto } from '../engine/dto/game-action.dto';
export type ActionPipelineHandlers<State, Action, ValidatedPayload = undefined, TransitionResult = State> = {
    guard?: (state: State, action: Action) => boolean;
    validate?: (state: State, action: Action) => ValidatedPayload;
    transition: (state: State, action: Action, payload: ValidatedPayload) => TransitionResult;
    effects?: (state: State, action: Action, payload: ValidatedPayload, transitionResult: TransitionResult) => State;
    logs?: (state: State, action: Action, payload: ValidatedPayload, transitionResult: TransitionResult, effectedState: State) => State;
};
export type ActionStateShape = {
    status?: unknown;
    pending?: unknown;
    metadata?: unknown;
};
export declare function harmonizeActionStateReturn<State extends ActionStateShape>(state: State): State;
export declare function applyActionPipeline<State, Action, ValidatedPayload = undefined, TransitionResult = State>(state: State, action: Action, handlers: ActionPipelineHandlers<State, Action, ValidatedPayload, TransitionResult>): State;
export declare function normalizeActionType(action: Pick<GameSingleActionDto, 'type'> | null | undefined): string;
export declare function normalizeLowerActionType(action: Pick<GameSingleActionDto, 'type'> | null | undefined): string;
export declare function isRollAlias(rawType: unknown, normalizedType?: unknown): boolean;
export declare function normalizeLegacyRollAliasToUpper(rawType: unknown): string;
export declare function normalizeRollActionType(rawType: unknown, fallback?: string): string;
export declare function isRollActionType(rawType: unknown, normalizedType?: unknown): boolean;
export declare function applyActionsSequentially<State, Action>(state: State, actions: Action[] | null | undefined, applier: (state: State, action: Action) => State): State;
export declare function dispatchByActionType<State>(type: string, handlers: Record<string, () => State>, fallback: () => State): State;
