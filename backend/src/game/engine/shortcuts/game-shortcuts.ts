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

export type GameShortcutsContext<TMetadata = unknown> = {
  metadata: TMetadata;
  currentPlayerId: number | null;
  started: boolean;
};

export type GameShortcutsBuilder<TMetadata = unknown> = (
  ctx: GameShortcutsContext<TMetadata>,
) => GameShortcutHint[];
