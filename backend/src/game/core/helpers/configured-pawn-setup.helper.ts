import type { GameStateEntity } from '../entities/game-state.entity';
import type { GameCoreService } from '../services/game-core.service';
import type { SetupFlowService } from '../../modules/setup-flow/services/setup-flow.service';
import { resolvePlayerNameFromState } from '../../modules/turn-policies/player-name.helper';

export type ConfiguredSetupPawnChoice = {
  id: string;
  label: string;
  description?: string;
  [key: string]: unknown;
};

export function assignConfiguredBotPawns(params: {
  state: GameStateEntity;
  core: GameCoreService;
  catalog: ConfiguredSetupPawnChoice[];
  metadataAssignmentKey?: string;
  playerPawnField?: string | false;
  playerPawnLabelField?: string | false;
  playerPawnLabelResolver?: (
    choice: ConfiguredSetupPawnChoice,
    state: GameStateEntity,
  ) => string;
  logLabelResolver?: (
    choice: ConfiguredSetupPawnChoice,
    state: GameStateEntity,
  ) => string;
  isBotPlayer?: (player: any, state: GameStateEntity) => boolean;
  pickChoice?: (params: {
    state: GameStateEntity;
    player: any;
    available: ConfiguredSetupPawnChoice[];
    catalog: ConfiguredSetupPawnChoice[];
  }) =>
    | { choice: ConfiguredSetupPawnChoice | null; state?: GameStateEntity }
    | ConfiguredSetupPawnChoice
    | null;
  playerNameOptions?: unknown;
}): GameStateEntity {
  const players = Array.isArray(params.state.players) ? params.state.players : [];
  if (!players.length || !params.catalog.length) {
    return params.state;
  }

  let working: GameStateEntity = params.state;
  let metadata = asRecord(working.metadata);
  const assignedById = params.metadataAssignmentKey
    ? asRecord(metadata[params.metadataAssignmentKey])
    : {};
  const taken = collectTakenPawnIds(
    working,
    params.metadataAssignmentKey,
    params.playerPawnField,
  );

  const nextPlayers = players.map((player) => {
    if (!(params.isBotPlayer ?? defaultIsBotPlayer)(player, working)) {
      return player;
    }

    const currentPawn = resolveAssignedPawnId(
      player,
      assignedById,
      params.playerPawnField,
    );
    if (currentPawn) {
      taken.add(currentPawn);
      return player;
    }

    const available = params.catalog.filter((choice) => !taken.has(choice.id));
    const pool = available.length > 0 ? available : params.catalog;
    const picked = params.pickChoice?.({
      state: working,
      player,
      available: pool,
      catalog: params.catalog,
    });
    const resolved =
      picked && typeof picked === 'object' && 'choice' in picked
        ? picked
        : {
            choice:
              (picked as ConfiguredSetupPawnChoice | null) ??
              pool[0] ??
              params.catalog[0] ??
              null,
          };
    if (resolved.state) {
      working = resolved.state;
      metadata = asRecord(working.metadata);
    }
    const choice = resolved.choice;
    if (!choice?.id) {
      return player;
    }

    taken.add(choice.id);
    if (params.metadataAssignmentKey) {
      metadata = {
        ...metadata,
        [params.metadataAssignmentKey]: {
          ...asRecord(metadata[params.metadataAssignmentKey]),
          [String(player?.id ?? '')]: choice.id,
        },
      };
    }

    const updated =
      player != null && typeof player === 'object'
        ? ({ ...player } as Record<string, unknown>)
        : ({} as Record<string, unknown>);
    if (params.playerPawnField) {
      updated[params.playerPawnField] = choice.id;
    }
    if (params.playerPawnLabelField) {
      updated[params.playerPawnLabelField] =
        typeof params.playerPawnLabelResolver === 'function'
          ? params.playerPawnLabelResolver(choice, working)
          : choice.label;
    }

    working = {
      ...working,
      metadata,
    };
    const playerName = resolvePlayerNameFromState(
      {
        ...working,
        players: replacePlayer(players, updated, Number(player?.id)),
      },
      Number(player?.id),
      params.playerNameOptions as any,
    );
    const prompt = `C'est à ${playerName} de choisir son pion.`;
    let withUpdatedPlayers = {
      ...working,
      players: replacePlayer(players, updated, Number(player?.id)),
      metadata,
    };
    const hasPrompt = Array.isArray(withUpdatedPlayers.log)
      ? withUpdatedPlayers.log
          .slice(-6)
          .some((entry) => String(entry?.message ?? '').trim() === prompt)
      : false;
    if (!hasPrompt) {
      working = params.core.appendLog(withUpdatedPlayers, prompt);
      withUpdatedPlayers = {
        ...working,
        players: replacePlayer(players, updated, Number(player?.id)),
        metadata,
      };
    }
    const logLabel =
      typeof params.logLabelResolver === 'function'
        ? params.logLabelResolver(choice, working)
        : choice.label || choice.id;
    working = params.core.appendLog(
      withUpdatedPlayers,
      `${playerName} a choisi le pion: ${logLabel}.`,
    );
    return updated;
  });

  return {
    ...working,
    players: nextPlayers,
    metadata,
  };
}

export function queueConfiguredPawnSelection(params: {
  state: GameStateEntity;
  core?: GameCoreService;
  setupFlow: SetupFlowService;
  catalog: ConfiguredSetupPawnChoice[];
  startPlayerId?: number | null;
  pendingType?: 'choose_pawn' | 'pick_pawn';
  metadataAssignmentKey?: string;
  playerPawnField?: string | false;
  isBotPlayer?: (player: any, state: GameStateEntity) => boolean;
  takenPawnIdsResolver?: (
    state: GameStateEntity,
    catalog: ConfiguredSetupPawnChoice[],
  ) => Set<string>;
  includeChoiceMapData?: boolean;
  choiceLabelBuilder?: (choice: ConfiguredSetupPawnChoice) => string;
  pawnDataMapper?: (choice: ConfiguredSetupPawnChoice) => Record<string, unknown>;
  extraPendingData?: Record<string, unknown>;
}): GameStateEntity {
  const players = Array.isArray(params.state.players) ? params.state.players : [];
  if (!players.length || !params.catalog.length) {
    return params.state;
  }

  const taken =
    typeof params.takenPawnIdsResolver === 'function'
      ? params.takenPawnIdsResolver(params.state, params.catalog)
      : collectTakenPawnIds(
          params.state,
          params.metadataAssignmentKey,
          params.playerPawnField,
        );
  const available = params.catalog.filter((choice) => !taken.has(choice.id));
  const pawns = available.length > 0 ? available : params.catalog;

  const pendingInfo = params.setupFlow.createSequentialPawnPending({
    players: players as Array<{ id: number; username?: string | null }>,
    startPlayerId: params.startPlayerId,
    isAssigned: (playerId) => {
      const player = players.find((entry) => Number(entry?.id) === playerId);
      if (!player) return true;
      if ((params.isBotPlayer ?? defaultIsBotPlayer)(player, params.state)) {
        return true;
      }
      return hasAssignedPawn(
        params.state,
        playerId,
        params.metadataAssignmentKey,
        params.playerPawnField,
      );
    },
    pendingType: params.pendingType ?? 'choose_pawn',
    pawns,
    includeChoiceMapData: params.includeChoiceMapData,
    choiceLabelBuilder: params.choiceLabelBuilder,
    pawnDataMapper: params.pawnDataMapper,
    extraPendingData: params.extraPendingData,
  });

  if (!pendingInfo) {
    return params.state.pending
      ? { ...params.state, pending: null }
      : params.state;
  }

  let next: GameStateEntity = {
    ...params.state,
    pending: pendingInfo.pending,
    turnIndex: pendingInfo.turnIndex,
    turn: {
      ...(params.state.turn ?? { direction: 1 }),
      currentPlayerId: pendingInfo.playerId,
      direction:
        params.state.turn?.direction === -1 && !params.state.pending ? -1 : 1,
    },
  };
  if (!params.core) {
    return next;
  }

  const prompt = `C'est à ${resolvePlayerNameFromState(next, pendingInfo.playerId)} de choisir son pion.`;
  const hasPrompt = Array.isArray(next.log)
    ? next.log
        .slice(-6)
        .some((entry) => String(entry?.message ?? '').trim() === prompt)
    : false;
  if (!hasPrompt) {
    next = params.core.appendLog(next, prompt);
  }
  return next;
}

function replacePlayer(
  players: Array<any>,
  updated: Record<string, unknown>,
  playerId: number,
): Array<any> {
  return players.map((player) =>
    Number(player?.id) === playerId ? updated : player,
  );
}

function defaultIsBotPlayer(player: any): boolean {
  return player?.isBot === true;
}

function collectTakenPawnIds(
  state: GameStateEntity,
  metadataAssignmentKey: string | undefined,
  playerPawnField: string | false | undefined,
): Set<string> {
  const taken = new Set<string>();
  const metadata = asRecord(state.metadata);
  if (metadataAssignmentKey) {
    for (const value of Object.values(asRecord(metadata[metadataAssignmentKey]))) {
      const text = toText(value);
      if (text) taken.add(text);
    }
  }
  if (playerPawnField) {
    const players = Array.isArray(state.players) ? state.players : [];
    for (const player of players) {
      const text = toText(asRecord(player)[playerPawnField]);
      if (text) taken.add(text);
    }
  }
  return taken;
}

function resolveAssignedPawnId(
  player: any,
  assignedById: Record<string, unknown>,
  playerPawnField: string | false | undefined,
): string {
  const metadataValue = toText(assignedById[String(player?.id ?? '')]);
  if (metadataValue) return metadataValue;
  if (playerPawnField) {
    return toText(asRecord(player)[playerPawnField]);
  }
  return '';
}

function hasAssignedPawn(
  state: GameStateEntity,
  playerId: number,
  metadataAssignmentKey: string | undefined,
  playerPawnField: string | false | undefined,
): boolean {
  const players = Array.isArray(state.players) ? state.players : [];
  const player = players.find((entry) => Number(entry?.id) === playerId);
  if (!player) return true;
  return (
    resolveAssignedPawnId(
      player,
      metadataAssignmentKey
        ? asRecord(asRecord(state.metadata)[metadataAssignmentKey])
        : {},
      playerPawnField,
    ).length > 0
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : {};
}

function toText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return '';
}
