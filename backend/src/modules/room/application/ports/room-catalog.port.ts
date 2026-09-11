export type RoomGameManifest = {
  id: string;
  name: string;
  status: string;
  minPlayers?: number;
  maxPlayers?: number;
  chatEnabled?: boolean;
  chatSoundsEnabled?: boolean;
};

export interface RoomCatalogPort {
  getGame(id: string): Promise<RoomGameManifest | undefined>;
}

export const ROOM_CATALOG_PORT = Symbol('ROOM_CATALOG_PORT');
