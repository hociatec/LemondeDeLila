export type LobbyWsVariant = 'legacy' | 'lobby';

export type LobbyUser = {
  id: number;
  username: string;
  roles?: string[] | null;
};
