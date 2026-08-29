import { WebSocket } from 'ws';

type SocketRoomMap = Map<number, Set<WebSocket>>;
type ClientLookup<TMeta> = Map<WebSocket, TMeta>;

export function addSocketToRoomMembership(
  rooms: SocketRoomMap,
  silentRooms: SocketRoomMap,
  roomId: number,
  client: WebSocket,
  silent: boolean,
): void {
  const targetMap = silent ? silentRooms : rooms;
  let sockets = targetMap.get(roomId);
  if (!sockets) {
    sockets = new Set();
    targetMap.set(roomId, sockets);
  }
  sockets.add(client);
}

export function removeSocketFromRoomMembership(
  rooms: SocketRoomMap,
  silentRooms: SocketRoomMap,
  roomId: number,
  client: WebSocket,
): {
  remainingConnections: number;
  remainingSilentConnections: number;
  remainingTotalConnections: number;
} {
  const remainingConnections = removeFromSetMap(rooms, roomId, client);
  const remainingSilentConnections = removeFromSetMap(
    silentRooms,
    roomId,
    client,
  );

  return {
    remainingConnections,
    remainingSilentConnections,
    remainingTotalConnections:
      remainingConnections + remainingSilentConnections,
  };
}

export function hasUserConnectionsInRoom<
  TMeta extends { userId: number; roomId: number },
>(
  rooms: SocketRoomMap,
  silentRooms: SocketRoomMap,
  clients: ClientLookup<TMeta>,
  roomId: number,
  userId: number,
): boolean {
  return (
    hasUserConnectionInMap(rooms, clients, roomId, userId) ||
    hasUserConnectionInMap(silentRooms, clients, roomId, userId)
  );
}

function removeFromSetMap(
  map: SocketRoomMap,
  roomId: number,
  client: WebSocket,
): number {
  const set = map.get(roomId);
  if (!set) {
    return 0;
  }

  set.delete(client);
  if (set.size === 0) {
    map.delete(roomId);
    return 0;
  }

  return set.size;
}

function hasUserConnectionInMap<
  TMeta extends { userId: number; roomId: number },
>(
  map: SocketRoomMap,
  clients: ClientLookup<TMeta>,
  roomId: number,
  userId: number,
): boolean {
  const set = map.get(roomId);
  if (!set) {
    return false;
  }

  for (const socket of set.values()) {
    const meta = clients.get(socket);
    if (meta?.userId === userId && meta.roomId === roomId) {
      return true;
    }
  }

  return false;
}
