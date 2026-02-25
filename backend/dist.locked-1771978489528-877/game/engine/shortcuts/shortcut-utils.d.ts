import type { GameShortcutHint, GameShortcutsContext } from './game-shortcuts';
export declare function pressed(key: string): string;
export declare function interfaceShortcut(key: string, id: string): GameShortcutHint;
export declare function actionShortcut(key: string, actionType: string): GameShortcutHint;
export declare function when<TMeta>(_ctx: GameShortcutsContext<TMeta>, condition: boolean, shortcuts: readonly GameShortcutHint[]): GameShortcutHint[];
export declare function concat(...parts: Array<readonly GameShortcutHint[]>): GameShortcutHint[];
