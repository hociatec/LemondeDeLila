import {
  isVaultGameState,
  type VaultGameState,
} from '../models/vault-game-state.model';
import { remapPlayerReferences } from './vault-player-reference-remapper';

export type VaultGameStateRemapOptions = {
  roomId: number;
  roomOwnerId: number;
  roomStartedAt: string | null;
  roomRunId: number | null;
  botIdMap: Map<number, number>;
  botNamesByNewId: Map<number, string>;
};

export function remapVaultGameState(
  state: VaultGameState,
  options: VaultGameStateRemapOptions,
): VaultGameState {
  const remapped = remapPlayerReferences(state, options.botIdMap);
  if (!isVaultGameState(remapped)) {
    throw new Error('État de jeu Vault invalide après remappage.');
  }
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
      const id = player.id;
      const username =
        typeof id === 'number' && id < 0 && options.botNamesByNewId.has(id)
          ? options.botNamesByNewId.get(id)
          : player?.username;
      return { ...player, id, username };
    });
  }
  return remapped;
}
