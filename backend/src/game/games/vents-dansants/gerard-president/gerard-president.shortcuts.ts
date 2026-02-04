import type { GerardPresidentActionType } from '../definitions/game.definition';

export const GERARD_PRESIDENT_SHORTCUTS: Record<string, GerardPresidentActionType> = {
  setTheme: 'set_theme',
  playName: 'play_name',
  playSpecial: 'play_special',
  chooseWinner: 'choose_winner',
  pass: 'pass',
};
