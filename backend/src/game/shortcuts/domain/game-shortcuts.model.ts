export type GameShortcutHint =
  | {
      key: string;
      type: 'interface';
      id: string;
    }
  | {
      key: string;
      type: 'action';
      actionType: string;
    };

export type GameShortcutsContext = {
  currentPlayerId: number | null;
  started: boolean;
};

export type GameShortcutsBuilder = (
  ctx: GameShortcutsContext,
) => GameShortcutHint[];
