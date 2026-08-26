import type { VaultGameState } from '../models/vault-game-state.model';

export type VaultGameStateRemapOptions = {
  roomId: number;
  roomOwnerId: number;
  roomStartedAt: string | null;
  roomRunId: number | null;
  botIdMap: Map<number, number>;
  botNamesByNewId: Map<number, string>;
};

function remapValue(value: unknown, botIdMap: Map<number, number>): unknown {
  if (
    value == null ||
    typeof value === 'string' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'number') {
    return botIdMap.get(value) ?? value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => remapValue(item, botIdMap));
  }
  if (typeof value !== 'object') {
    return value;
  }
  const remapped: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    const numericKey = Number(key);
    const nextKey =
      Number.isFinite(numericKey) && botIdMap.has(numericKey)
        ? String(botIdMap.get(numericKey))
        : key;
    remapped[nextKey] = remapValue(item, botIdMap);
  }
  return remapped;
}

export function remapVaultGameState(
  state: VaultGameState,
  options: VaultGameStateRemapOptions,
): VaultGameState {
  const replaceId = (value: number): number =>
    options.botIdMap.get(value) ?? value;
  const remapped = remapValue(state, options.botIdMap) as VaultGameState;
  remapped.status = 'started';
  remapped.metadata = {
    ...(remapped.metadata ?? {}),
    roomId: options.roomId,
    roomOwnerId: options.roomOwnerId,
    roomStartedAt: options.roomStartedAt,
    roomRunId: options.roomRunId,
  };
  if (Array.isArray(remapped.players)) {
    remapped.players = remapped.players.map((player) => {
      const id =
        typeof player?.id === 'number' ? replaceId(player.id) : player?.id;
      const username =
        typeof id === 'number' && id < 0 && options.botNamesByNewId.has(id)
          ? options.botNamesByNewId.get(id)
          : player?.username;
      return { ...player, id, username };
    });
  }
  if (remapped.turn && typeof remapped.turn.currentPlayerId === 'number') {
    remapped.turn = {
      ...remapped.turn,
      currentPlayerId: replaceId(remapped.turn.currentPlayerId),
    };
  }
  return remapped;
}
