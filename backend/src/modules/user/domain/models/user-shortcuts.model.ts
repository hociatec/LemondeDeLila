export type UserShortcut = {
  target: string;
  label: string;
  chord: string;
  enabled: boolean;
};
export type UserShortcuts = { revision: number; items: UserShortcut[] };
