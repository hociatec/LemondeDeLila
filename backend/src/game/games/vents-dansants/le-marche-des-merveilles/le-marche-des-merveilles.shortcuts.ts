import type { GameShortcutsBuilder } from '../../../shortcuts/public-api';
import { actionShortcut } from '../../../shortcuts/public-api';

export const buildLeMarcheDesMerveillesShortcuts: GameShortcutsBuilder = () => [
  actionShortcut('A', 'buy_gemmes'),
  actionShortcut('Z', 'buy_potions'),
  actionShortcut('E', 'buy_reliques'),
  actionShortcut('R', 'buy_ingredients'),
  actionShortcut('Q', 'sell_gemmes'),
  actionShortcut('S', 'sell_potions'),
  actionShortcut('D', 'sell_reliques'),
  actionShortcut('F', 'sell_ingredients'),
  actionShortcut('1', 'rumor_up_gemmes'),
  actionShortcut('2', 'rumor_up_potions'),
  actionShortcut('3', 'rumor_up_reliques'),
  actionShortcut('4', 'rumor_up_ingredients'),
  actionShortcut('5', 'rumor_down_gemmes'),
  actionShortcut('6', 'rumor_down_potions'),
  actionShortcut('7', 'rumor_down_reliques'),
  actionShortcut('8', 'rumor_down_ingredients'),
  actionShortcut('P', 'protect'),
  actionShortcut('V', 'steal_deal_best'),
  actionShortcut('O', 'pass'),
];
