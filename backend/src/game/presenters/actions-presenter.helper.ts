import type { GameSingleActionDto } from '../engine/dto/game-action.dto';

type PresentedAction = {
  type: string;
  label: string;
  payload: Record<string, any>;
};

export function formatPresenterActions(
  actions: GameSingleActionDto[],
  labelResolver?: (action: GameSingleActionDto) => string,
): PresentedAction[] {
  return (actions ?? []).map((action) => ({
    type: action.type,
    label: labelResolver ? labelResolver(action) : action.type,
    payload: action.payload ?? {},
  }));
}
