import type { GameStateEntity } from '../entities/game-state.entity';
import type { GameSingleActionDto } from '../../engine/dto/game-action.dto';
import { resolvePlayerNameFromState } from '../../modules/turn-policies/player-name.helper';
import type { SetupFlowService } from '../../modules/setup-flow/services/setup-flow.service';
import type { GameCoreService } from '../services/game-core.service';
import { resolvePendingPawnChoiceAction } from './pawn-choice-action.helper';

export type ConfiguredPawnChoice = {
  id: string;
  label: string;
  description?: string;
  [key: string]: unknown;
};

export function applyConfiguredPawnSelection(params: {
  state: GameStateEntity;
  action: GameSingleActionDto;
  setupFlow: SetupFlowService;
  core: GameCoreService;
  pendingType?: 'choose_pawn' | 'pick_pawn';
  metadataCatalogKey?: string;
  metadataAssignmentKey?: string;
  playerPawnField?: string | false;
  playerPawnLabelField?: string | false;
  playerMatcher?: (player: any, playerId: number) => boolean;
  choiceCatalogFallback?: (
    options: Array<Record<string, unknown>>,
  ) => ConfiguredPawnChoice[];
  playerPawnLabelResolver?: (
    choice: ConfiguredPawnChoice,
    state: GameStateEntity,
  ) => string;
  logLabelResolver?: (
    choice: ConfiguredPawnChoice,
    state: GameStateEntity,
  ) => string;
  logPrefix?: string;
  extraMetadataBuilder?: (params: {
    state: GameStateEntity;
    playerId: number;
    choice: ConfiguredPawnChoice;
    metadata: Record<string, unknown>;
  }) => Record<string, unknown>;
  isTakenByOtherPlayer?: (
    state: GameStateEntity,
    playerId: number,
    pawnId: string,
  ) => boolean;
  playerNameOptions?: unknown;
}):
  | {
      state: GameStateEntity;
      playerId: number;
      choice: ConfiguredPawnChoice;
    }
  | null {
  const resolved = resolvePendingPawnChoiceAction({
    state: params.state,
    action: params.action,
    pendingType: params.pendingType ?? 'choose_pawn',
    resolveChoice: (rawPawn, options) =>
      params.setupFlow.resolvePawnChoice(rawPawn, options),
  });
  if (!resolved) return null;

  const { playerId, options, chosen } = resolved;
  const catalog = resolveCatalog(
    params.state,
    params.metadataCatalogKey,
    options,
    params.choiceCatalogFallback,
  );
  const choice = resolveChoiceEntry(chosen, catalog);
  if (!choice.id) return null;

  if (
    typeof params.isTakenByOtherPlayer === 'function'
      ? params.isTakenByOtherPlayer(params.state, playerId, choice.id)
      : isTakenByOtherPlayer(
          params.state,
          playerId,
          choice.id,
          params.metadataAssignmentKey,
          params.playerPawnField,
        )
  ) {
    return null;
  }

  const metadata =
    params.state.metadata != null && typeof params.state.metadata === 'object'
      ? ({ ...(params.state.metadata as Record<string, unknown>) } as Record<
          string,
          unknown
        >)
      : {};

  if (params.metadataCatalogKey && catalog.length > 0) {
    metadata[params.metadataCatalogKey] = catalog;
  }

  if (params.metadataAssignmentKey) {
    const assigned = asRecord(metadata[params.metadataAssignmentKey]);
    if (toText(assigned[playerId]).length > 0) return null;
    metadata[params.metadataAssignmentKey] = {
      ...assigned,
      [playerId]: choice.id,
    };
  }

  if (typeof params.extraMetadataBuilder === 'function') {
    Object.assign(
      metadata,
      params.extraMetadataBuilder({
        state: params.state,
        playerId,
        choice,
        metadata,
      }),
    );
  }

  const players = Array.isArray(params.state.players)
    ? params.state.players.map((player) => {
        if (
          !(params.playerMatcher ?? defaultPlayerMatcher)(player, playerId)
        ) {
          return player;
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
              ? params.playerPawnLabelResolver(choice, params.state)
              : choice.label;
        }
        return updated;
      })
    : params.state.players;

  let next: GameStateEntity = {
    ...params.state,
    players,
    pending: null,
    metadata,
  };

  const label =
    typeof params.logLabelResolver === 'function'
      ? params.logLabelResolver(choice, next)
      : choice.label || choice.id || 'pion';
  const prefix = toText(params.logPrefix);
  next = params.core.appendLog(
    next,
    `${prefix}${resolvePlayerNameFromState(
      next,
      playerId,
      params.playerNameOptions as any,
    )} a choisi le pion: ${label}.`,
  );

  return { state: next, playerId, choice };
}

function resolveCatalog(
  state: GameStateEntity,
  metadataCatalogKey: string | undefined,
  options: Array<Record<string, unknown>>,
  choiceCatalogFallback:
    | ((options: Array<Record<string, unknown>>) => ConfiguredPawnChoice[])
    | undefined,
): ConfiguredPawnChoice[] {
  const metadata =
    state.metadata != null && typeof state.metadata === 'object'
      ? (state.metadata as Record<string, unknown>)
      : {};
  const rawCatalog = metadataCatalogKey
    ? metadata[metadataCatalogKey]
    : undefined;
  if (Array.isArray(rawCatalog) && rawCatalog.length > 0) {
    return rawCatalog.map(normalizeChoice);
  }
  if (typeof choiceCatalogFallback === 'function') {
    return choiceCatalogFallback(options);
  }
  return options.map(normalizeChoice);
}

function resolveChoiceEntry(
  chosen: Record<string, unknown>,
  catalog: ConfiguredPawnChoice[],
): ConfiguredPawnChoice {
  const chosenId = toText(chosen.id);
  const fromCatalog = catalog.find((entry) => entry.id === chosenId);
  return fromCatalog ?? normalizeChoice(chosen);
}

function isTakenByOtherPlayer(
  state: GameStateEntity,
  playerId: number,
  pawnId: string,
  metadataAssignmentKey: string | undefined,
  playerPawnField: string | false | undefined,
): boolean {
  const metadata =
    state.metadata != null && typeof state.metadata === 'object'
      ? (state.metadata as Record<string, unknown>)
      : {};
  if (metadataAssignmentKey) {
    const assigned = asRecord(metadata[metadataAssignmentKey]);
    for (const [key, value] of Object.entries(assigned)) {
      const candidateId = Number(key);
      if (!Number.isFinite(candidateId) || candidateId === playerId) continue;
      if (toText(value) === pawnId) return true;
    }
  }

  if (playerPawnField) {
    const players = Array.isArray(state.players) ? state.players : [];
    for (const player of players) {
      const row = asRecord(player);
      const candidateId = Number(row.id);
      if (!Number.isFinite(candidateId) || candidateId === playerId) continue;
      if (toText(row[playerPawnField]) === pawnId) return true;
    }
  }

  return false;
}

function normalizeChoice(value: Record<string, unknown>): ConfiguredPawnChoice {
  return {
    ...value,
    id: toText(value.id),
    label: toText(value.label || value.name || value.id),
    description: toText(value.description),
  };
}

function defaultPlayerMatcher(player: any, playerId: number): boolean {
  return Number(player?.id) === playerId;
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
