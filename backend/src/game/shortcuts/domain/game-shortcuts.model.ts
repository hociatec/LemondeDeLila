export type GameShortcutHint =
  | {
      key: string;
      type: 'interface';
      id: string;
      label?: string;
    }
  | {
      key: string;
      type: 'action';
      actionType: string;
      label?: string;
    };

export type GameShortcutsContext = {
  currentPlayerId: number | null;
  started: boolean;
};

export type GameShortcutsBuilder = (
  ctx: GameShortcutsContext,
) => GameShortcutHint[];
