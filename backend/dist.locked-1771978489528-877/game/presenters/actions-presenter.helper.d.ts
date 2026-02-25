import type { GameSingleActionDto } from '../engine/dto/game-action.dto';
type PresentedAction = {
    type: string;
    label: string;
    payload: Record<string, unknown>;
};
export declare function formatPresenterActions(actions: GameSingleActionDto[], labelResolver?: (action: GameSingleActionDto) => string): PresentedAction[];
export {};
