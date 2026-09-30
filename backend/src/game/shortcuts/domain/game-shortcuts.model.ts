export type GameShortcutHint =
  | {
      key: string;
      type: 'interface';
      id: string;
      label?: string;
      /** Requires focus on the represented control instead of global activation. */
      activation?: 'direct' | 'focus-only';
    }
  | {
      key: string;
      type: 'action';
      actionType: string;
      label?: string;
      /** Requires focus on the represented control instead of global activation. */
      activation?: 'direct' | 'focus-only';
    };

export type GameShortcutsContext = {
  currentPlayerId: number | null;
  started: boolean;
};

export type GameShortcutsBuilder = (
  ctx: GameShortcutsContext,
) => GameShortcutHint[];
